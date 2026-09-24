import { Router, Request, Response } from "express";
import crypto from "node:crypto";
import { getDbStore, KitDoc } from "./db";
import {
  hashPassword,
  verifyPassword,
  createSession,
  invalidateSession,
  setSessionCookie,
  clearSessionCookie,
  requireAuth,
} from "./auth";
import {
  registerRequestSchema,
  loginRequestSchema,
  createKitRequestSchema,
  updateQuestionSchema,
  createQuestionSchema,
  updateFlashcardSchema,
  createFlashcardSchema,
  recordPracticeReviewSchema,
} from "../../packages/shared/schemas";
import { computeKitFingerprint } from "../../packages/pipeline/fingerprint";
import { runGenerationPipeline } from "../../packages/pipeline/pipeline";
import { mergeRegeneratedQuestions, recalculateKitDerivedState } from "../../packages/pipeline/merge";
import { generateCategoryQuestions } from "../../packages/generation/questionGeneration";
import { generateCompanyBrief } from "../../packages/generation/companyBrief";
import { generateDeterministicSchedule } from "../../packages/scheduler/scheduler";
import { LlmClient } from "../../packages/generation/llmClient";
import { CompanyCrawler } from "../../packages/retrieval/crawler";
import { Question, QuestionCategory, WeakSpotItem } from "../../packages/shared/types";

export const apiRouter = Router();

// ----------------------------------------------------
// AUTHENTICATION
// ----------------------------------------------------

apiRouter.post("/auth/register", async (req: Request, res: Response) => {
  const parse = registerRequestSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message });
    return;
  }

  const { email, password, name } = parse.data;
  const db = await getDbStore();

  const existing = await db.users.findByEmail(email);
  if (existing) {
    res.status(409).json({ error: "Email is already registered" });
    return;
  }

  const passwordHash = await hashPassword(password);
  const user = await db.users.insert({
    email,
    passwordHash,
    name: name || email.split("@")[0],
    createdAt: new Date().toISOString(),
  });

  const token = createSession(user._id);
  setSessionCookie(res, token);

  res.status(201).json({
    user: { id: user._id, email: user.email, name: user.name },
    token,
  });
});

apiRouter.post("/auth/login", async (req: Request, res: Response) => {
  const parse = loginRequestSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message });
    return;
  }

  const { email, password } = parse.data;
  const db = await getDbStore();

  const user = await db.users.findByEmail(email);
  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = createSession(user._id);
  setSessionCookie(res, token);

  res.json({
    user: { id: user._id, email: user.email, name: user.name },
    token,
  });
});

apiRouter.post("/auth/logout", (req: Request, res: Response) => {
  const token = req.cookies?.prepkit_session;
  if (token) {
    invalidateSession(token);
  }
  clearSessionCookie(res);
  res.json({ success: true, message: "Logged out successfully" });
});

apiRouter.get("/auth/me", requireAuth, (req: Request, res: Response) => {
  res.json({ user: req.user });
});

// ----------------------------------------------------
// KITS MANAGEMENT
// ----------------------------------------------------

// List all kits for the authenticated user
apiRouter.get("/kits", requireAuth, async (req: Request, res: Response) => {
  const db = await getDbStore();
  const kits = await db.kits.findByUser(req.user!.id);
  res.json({ kits });
});

// Create a new kit (async generation)
apiRouter.post("/kits", requireAuth, async (req: Request, res: Response) => {
  const parse = createKitRequestSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message });
    return;
  }

  const { jd, company_url, days } = parse.data;
  const userId = req.user!.id;
  const fingerprint = computeKitFingerprint(jd, company_url);
  const db = await getDbStore();

  // Duplicate detection
  const duplicate = await db.kits.findByFingerprint(userId, fingerprint);
  if (duplicate && duplicate.generation.status === "completed") {
    res.status(200).json({
      duplicate: true,
      kitId: duplicate._id,
      message: "An interview kit for this exact job description and company already exists.",
      kit: duplicate,
    });
    return;
  }

  // Create kit placeholder in running state
  const now = new Date().toISOString();
  const initialKit = await db.kits.insert({
    userId,
    fingerprint,
    source: {
      company: company_url.replace(/https?:\/\//, "").split("/")[0],
      company_url,
      role: "Analyzing role...",
      location: "Analyzing...",
      jd_chars: jd.length,
      researched_at: now,
      pages_used: [company_url],
    },
    company_brief: {
      summary: "Gathering company intelligence...",
      what_they_do: "",
      sources: [company_url],
      _meta: { origin: "generated", edited: false, pinned: false },
    },
    role: {
      title: "Analyzing role...",
      seniority: "Analyzing...",
      responsibilities: [],
      requirements: [],
      _meta: { origin: "generated", edited: false, pinned: false },
    },
    questions: [],
    flashcards: [],
    schedule: {
      days_available: days,
      days: [],
    },
    coverage: {
      uncovered_requirement_ids: [],
      passes: 0,
    },
    generation: {
      status: "running",
      step: "Initializing multi-stage research pipeline",
      progress: 2,
      errors: [],
    },
    createdAt: now,
    updatedAt: now,
  });

  // Launch pipeline asynchronously
  (async () => {
    try {
      const result = await runGenerationPipeline({
        jd,
        company_url,
        days,
        allowLocal: process.env.NODE_ENV !== "production" || process.env.ALLOW_LOCAL_URLS === "true",
        onProgress: async (p) => {
          await db.kits.update(initialKit._id, userId, {
            generation: p,
          });
        },
      });

      await db.kits.update(initialKit._id, userId, {
        ...result.kit,
        generation: {
          status: "completed",
          step: "Ready",
          progress: 100,
          errors: result.errors,
        },
      });
    } catch (err: any) {
      await db.kits.update(initialKit._id, userId, {
        generation: {
          status: "failed",
          step: "Generation failed",
          progress: 100,
          errors: [err.message || "An unexpected error occurred during generation."],
        },
      });
    }
  })().catch(console.error);

  res.status(202).json({
    kitId: initialKit._id,
    status: "running",
    message: "Generation pipeline launched.",
  });
});

// Get a specific kit
apiRouter.get("/kits/:id", requireAuth, async (req: Request, res: Response) => {
  const db = await getDbStore();
  const kit = await db.kits.findById(req.params.id, req.user!.id);
  if (!kit) {
    res.status(404).json({ error: "Kit not found" });
    return;
  }
  res.json({ kit });
});

// Get generation progress/status
apiRouter.get("/kits/:id/status", requireAuth, async (req: Request, res: Response) => {
  const db = await getDbStore();
  const kit = await db.kits.findById(req.params.id, req.user!.id);
  if (!kit) {
    res.status(404).json({ error: "Kit not found" });
    return;
  }
  res.json({ generation: kit.generation });
});

// Update kit top-level fields (e.g. edited company brief or role)
apiRouter.patch("/kits/:id", requireAuth, async (req: Request, res: Response) => {
  const db = await getDbStore();
  const kit = await db.kits.findById(req.params.id, req.user!.id);
  if (!kit) {
    res.status(404).json({ error: "Kit not found" });
    return;
  }

  const { company_brief, role } = req.body;
  const updateData: Partial<KitDoc> = {};

  if (company_brief) {
    updateData.company_brief = {
      ...kit.company_brief,
      ...company_brief,
      _meta: { origin: kit.company_brief._meta?.origin || "generated", edited: true, pinned: kit.company_brief._meta?.pinned || false },
    };
  }

  if (role) {
    updateData.role = {
      ...kit.role,
      ...role,
      _meta: { origin: kit.role._meta?.origin || "generated", edited: true, pinned: kit.role._meta?.pinned || false },
    };
  }

  const updated = await db.kits.update(kit._id, req.user!.id, updateData);
  res.json({ kit: updated });
});

// Delete kit
apiRouter.delete("/kits/:id", requireAuth, async (req: Request, res: Response) => {
  const db = await getDbStore();
  const deleted = await db.kits.delete(req.params.id, req.user!.id);
  if (!deleted) {
    res.status(404).json({ error: "Kit not found" });
    return;
  }
  res.json({ success: true, message: "Kit deleted successfully" });
});

// ----------------------------------------------------
// REGENERATION ENDPOINTS
// ----------------------------------------------------

// Regenerate company brief
apiRouter.post("/kits/:id/regenerate/company", requireAuth, async (req: Request, res: Response) => {
  const db = await getDbStore();
  const kit = await db.kits.findById(req.params.id, req.user!.id);
  if (!kit) {
    res.status(404).json({ error: "Kit not found" });
    return;
  }

  const llm = new LlmClient();
  const crawler = new CompanyCrawler({ maxPages: 4, allowLocal: true });
  const crawl = await crawler.crawl(kit.source.company_url);
  const newBrief = await generateCompanyBrief(kit.source.company_url, crawl.pages, "", llm);

  const updated = await db.kits.update(kit._id, req.user!.id, {
    company_brief: {
      ...newBrief,
      _meta: { origin: "generated", edited: false, pinned: kit.company_brief._meta?.pinned || false },
    },
  });

  res.json({ kit: updated });
});

// Regenerate questions for a specific category (preserving user edits & pinned)
apiRouter.post("/kits/:id/regenerate/questions/:category", requireAuth, async (req: Request, res: Response) => {
  const category = req.params.category as QuestionCategory;
  if (!["technical", "behavioural", "system-design", "company-fit"].includes(category)) {
    res.status(400).json({ error: "Invalid question category" });
    return;
  }

  const db = await getDbStore();
  const kit = await db.kits.findById(req.params.id, req.user!.id);
  if (!kit) {
    res.status(404).json({ error: "Kit not found" });
    return;
  }

  const llm = new LlmClient();
  const newGenerated = await generateCategoryQuestions(
    category,
    kit.role.requirements,
    kit.role.title,
    kit.company_brief.summary,
    "",
    llm,
    kit.questions.length + 1
  );

  const mergedQuestions = mergeRegeneratedQuestions(kit.questions, newGenerated, category);
  const updatedKitWithRecalc = recalculateKitDerivedState({
    ...kit,
    questions: mergedQuestions,
  });

  const updated = await db.kits.update(kit._id, req.user!.id, updatedKitWithRecalc);
  res.json({ kit: updated });
});

// Regenerate schedule (preserves questions)
apiRouter.post("/kits/:id/regenerate/schedule", requireAuth, async (req: Request, res: Response) => {
  const db = await getDbStore();
  const kit = await db.kits.findById(req.params.id, req.user!.id);
  if (!kit) {
    res.status(404).json({ error: "Kit not found" });
    return;
  }

  const daysRequested = req.body.days ? Number(req.body.days) : kit.schedule.days_available;
  const newSchedule = generateDeterministicSchedule(kit.role.requirements, kit.questions, daysRequested);

  const updated = await db.kits.update(kit._id, req.user!.id, {
    schedule: newSchedule,
  });

  res.json({ kit: updated });
});

// ----------------------------------------------------
// QUESTIONS CRUD & REORDER
// ----------------------------------------------------

// Add manual question
apiRouter.post("/kits/:id/questions", requireAuth, async (req: Request, res: Response) => {
  const parse = createQuestionSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message });
    return;
  }

  const db = await getDbStore();
  const kit = await db.kits.findById(req.params.id, req.user!.id);
  if (!kit) {
    res.status(404).json({ error: "Kit not found" });
    return;
  }

  const newQuestion: Question = {
    id: `q_man_${Date.now()}`,
    requirement_ids: parse.data.requirement_ids.length > 0 ? parse.data.requirement_ids : (kit.role.requirements[0] ? [kit.role.requirements[0].id] : ["r1"]),
    category: parse.data.category,
    prompt: parse.data.prompt,
    answer_outline: parse.data.answer_outline,
    difficulty: parse.data.difficulty,
    _meta: { origin: "manual", edited: false, pinned: false },
  };

  const updatedKitWithRecalc = recalculateKitDerivedState({
    ...kit,
    questions: [...kit.questions, newQuestion],
  });

  const updated = await db.kits.update(kit._id, req.user!.id, updatedKitWithRecalc);
  res.status(201).json({ kit: updated, question: newQuestion });
});

// Edit question
apiRouter.patch("/kits/:id/questions/:questionId", requireAuth, async (req: Request, res: Response) => {
  const parse = updateQuestionSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message });
    return;
  }

  const db = await getDbStore();
  const kit = await db.kits.findById(req.params.id, req.user!.id);
  if (!kit) {
    res.status(404).json({ error: "Kit not found" });
    return;
  }

  const questionIndex = kit.questions.findIndex(q => q.id === req.params.questionId);
  if (questionIndex === -1) {
    res.status(404).json({ error: "Question not found" });
    return;
  }

  const current = kit.questions[questionIndex];
  const updatedQuestions = [...kit.questions];

  const pinnedState = parse.data.pinned !== undefined ? parse.data.pinned : (current._meta?.pinned ?? false);

  updatedQuestions[questionIndex] = {
    ...current,
    ...parse.data,
    _meta: {
      origin: current._meta?.origin || "generated",
      edited: true,
      pinned: pinnedState,
    },
  };

  const updatedKitWithRecalc = recalculateKitDerivedState({
    ...kit,
    questions: updatedQuestions,
  });

  const updated = await db.kits.update(kit._id, req.user!.id, updatedKitWithRecalc);
  res.json({ kit: updated, question: updatedQuestions[questionIndex] });
});

// Delete question
apiRouter.delete("/kits/:id/questions/:questionId", requireAuth, async (req: Request, res: Response) => {
  const db = await getDbStore();
  const kit = await db.kits.findById(req.params.id, req.user!.id);
  if (!kit) {
    res.status(404).json({ error: "Kit not found" });
    return;
  }

  const filteredQuestions = kit.questions.filter(q => q.id !== req.params.questionId);
  const updatedKitWithRecalc = recalculateKitDerivedState({
    ...kit,
    questions: filteredQuestions,
  });

  const updated = await db.kits.update(kit._id, req.user!.id, updatedKitWithRecalc);
  res.json({ kit: updated, message: "Question deleted" });
});

// Reorder questions
apiRouter.put("/kits/:id/questions/reorder", requireAuth, async (req: Request, res: Response) => {
  const { question_ids } = req.body;
  if (!Array.isArray(question_ids)) {
    res.status(400).json({ error: "question_ids must be an array" });
    return;
  }

  const db = await getDbStore();
  const kit = await db.kits.findById(req.params.id, req.user!.id);
  if (!kit) {
    res.status(404).json({ error: "Kit not found" });
    return;
  }

  const questionMap = new Map(kit.questions.map(q => [q.id, q]));
  const reordered: Question[] = [];

  for (const qId of question_ids) {
    const q = questionMap.get(qId);
    if (q) {
      reordered.push(q);
      questionMap.delete(qId);
    }
  }
  // Append any that were not mentioned
  for (const remaining of questionMap.values()) {
    reordered.push(remaining);
  }

  const updated = await db.kits.update(kit._id, req.user!.id, {
    questions: reordered,
  });

  res.json({ kit: updated });
});

// ----------------------------------------------------
// FLASHCARDS CRUD
// ----------------------------------------------------

apiRouter.post("/kits/:id/flashcards", requireAuth, async (req: Request, res: Response) => {
  const parse = createFlashcardSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message });
    return;
  }

  const db = await getDbStore();
  const kit = await db.kits.findById(req.params.id, req.user!.id);
  if (!kit) {
    res.status(404).json({ error: "Kit not found" });
    return;
  }

  const newFlashcard = {
    id: `f_man_${Date.now()}`,
    front: parse.data.front,
    back: parse.data.back,
    requirement_ids: parse.data.requirement_ids.length > 0 ? parse.data.requirement_ids : (kit.role.requirements[0] ? [kit.role.requirements[0].id] : ["r1"]),
    _meta: { origin: "manual" as const, edited: false, pinned: false },
  };

  const updated = await db.kits.update(kit._id, req.user!.id, {
    flashcards: [...kit.flashcards, newFlashcard],
  });

  res.status(201).json({ kit: updated, flashcard: newFlashcard });
});

apiRouter.patch("/kits/:id/flashcards/:flashcardId", requireAuth, async (req: Request, res: Response) => {
  const parse = updateFlashcardSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message });
    return;
  }

  const db = await getDbStore();
  const kit = await db.kits.findById(req.params.id, req.user!.id);
  if (!kit) {
    res.status(404).json({ error: "Kit not found" });
    return;
  }

  const idx = kit.flashcards.findIndex(f => f.id === req.params.flashcardId);
  if (idx === -1) {
    res.status(404).json({ error: "Flashcard not found" });
    return;
  }

  const current = kit.flashcards[idx];
  const updatedFlashcards = [...kit.flashcards];
  updatedFlashcards[idx] = {
    ...current,
    ...parse.data,
    _meta: {
      origin: current._meta?.origin || "generated",
      edited: true,
      pinned: parse.data.pinned !== undefined ? parse.data.pinned : (current._meta?.pinned ?? false),
    },
  };

  const updated = await db.kits.update(kit._id, req.user!.id, {
    flashcards: updatedFlashcards,
  });

  res.json({ kit: updated, flashcard: updatedFlashcards[idx] });
});

apiRouter.delete("/kits/:id/flashcards/:flashcardId", requireAuth, async (req: Request, res: Response) => {
  const db = await getDbStore();
  const kit = await db.kits.findById(req.params.id, req.user!.id);
  if (!kit) {
    res.status(404).json({ error: "Kit not found" });
    return;
  }

  const filtered = kit.flashcards.filter(f => f.id !== req.params.flashcardId);
  const updated = await db.kits.update(kit._id, req.user!.id, {
    flashcards: filtered,
  });

  res.json({ kit: updated, message: "Flashcard deleted" });
});

// ----------------------------------------------------
// PRACTICE & WEAK SPOTS
// ----------------------------------------------------

// Record practice review
apiRouter.post("/kits/:id/practice", requireAuth, async (req: Request, res: Response) => {
  const parse = recordPracticeReviewSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message });
    return;
  }

  const { cardId, confidence } = parse.data;
  const db = await getDbStore();

  const kit = await db.kits.findById(req.params.id, req.user!.id);
  if (!kit) {
    res.status(404).json({ error: "Kit not found" });
    return;
  }

  const card = kit.flashcards.find(f => f.id === cardId);
  if (!card) {
    res.status(404).json({ error: "Flashcard not found" });
    return;
  }

  const review = await db.practice.recordReview({
    id: crypto.randomUUID(),
    userId: req.user!.id,
    kitId: kit._id,
    cardId,
    confidence,
    reviewedAt: new Date().toISOString(),
  });

  res.status(201).json({ review });
});

// Get practice reviews
apiRouter.get("/kits/:id/practice", requireAuth, async (req: Request, res: Response) => {
  const db = await getDbStore();
  const reviews = await db.practice.getReviewsByKit(req.params.id, req.user!.id);
  res.json({ reviews });
});

// Weak Spots Report
apiRouter.get("/kits/:id/weak-spots", requireAuth, async (req: Request, res: Response) => {
  const db = await getDbStore();
  const kit = await db.kits.findById(req.params.id, req.user!.id);
  if (!kit) {
    res.status(404).json({ error: "Kit not found" });
    return;
  }

  const reviews = await db.practice.getReviewsByKit(kit._id, req.user!.id);

  // Group latest review confidence by card
  const latestConfidenceByCard = new Map<string, number>();
  for (const r of reviews) {
    latestConfidenceByCard.set(r.cardId, r.confidence);
  }

  // Aggregate by requirement
  const weakSpots: WeakSpotItem[] = [];

  for (const reqItem of kit.role.requirements) {
    // Find all cards covering this requirement
    const relatedCards = kit.flashcards.filter(f => f.requirement_ids.includes(reqItem.id));
    const relatedQuestions = kit.questions.filter(q => q.requirement_ids.includes(reqItem.id));

    let totalConf = 0;
    let reviewCount = 0;

    for (const card of relatedCards) {
      if (latestConfidenceByCard.has(card.id)) {
        totalConf += latestConfidenceByCard.get(card.id)!;
        reviewCount++;
      }
    }

    const avgConfidence = reviewCount > 0 ? Number((totalConf / reviewCount).toFixed(1)) : 0;

    let recommendation = "Unreviewed - Drill flashcards first";
    if (reviewCount > 0) {
      if (avgConfidence < 2.5) {
        recommendation = "High Priority: Practice technical deep-dive and flashcards";
      } else if (avgConfidence < 3.8) {
        recommendation = "Moderate: Review edge cases and answer outlines";
      } else {
        recommendation = "Proficient: Ready for live interview rehearsal";
      }
    }

    weakSpots.push({
      requirementId: reqItem.id,
      requirementText: reqItem.text,
      kind: reqItem.kind,
      averageConfidence: avgConfidence,
      reviewCount,
      associatedQuestionsCount: relatedQuestions.length,
      recommendedAction: recommendation,
    });
  }

  // Sort by weakest first (reviewed with lowest score, followed by unreviewed)
  weakSpots.sort((a, b) => {
    if (a.reviewCount > 0 && b.reviewCount === 0) return -1;
    if (a.reviewCount === 0 && b.reviewCount > 0) return 1;
    return a.averageConfidence - b.averageConfidence;
  });

  res.json({ weakSpots });
});
