import { z } from "zod";

export const itemMetaSchema = z.object({
  origin: z.enum(["generated", "manual"]).default("generated"),
  edited: z.boolean().default(false),
  pinned: z.boolean().default(false),
}).optional();

export const kitSourceSchema = z.object({
  company: z.string(),
  company_url: z.string(),
  role: z.string(),
  location: z.string(),
  jd_chars: z.number().int().nonnegative(),
  researched_at: z.string(),
  pages_used: z.array(z.string()),
});

export const companyBriefSchema = z.object({
  summary: z.string(),
  what_they_do: z.string(),
  sources: z.array(z.string()),
  _meta: itemMetaSchema,
});

export const requirementSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  kind: z.enum(["technical", "behavioural", "domain"]),
  priority: z.enum(["must", "nice"]),
  _meta: itemMetaSchema,
});

export const roleBreakdownSchema = z.object({
  title: z.string(),
  seniority: z.string(),
  responsibilities: z.array(z.string()),
  requirements: z.array(requirementSchema),
  _meta: itemMetaSchema,
});

export const questionSchema = z.object({
  id: z.string().min(1),
  requirement_ids: z.array(z.string()),
  category: z.enum(["technical", "behavioural", "system-design", "company-fit"]),
  prompt: z.string().min(1),
  answer_outline: z.string(),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  _meta: itemMetaSchema,
});

export const flashcardSchema = z.object({
  id: z.string().min(1),
  front: z.string().min(1),
  back: z.string().min(1),
  requirement_ids: z.array(z.string()),
  _meta: itemMetaSchema,
});

export const scheduleDaySchema = z.object({
  day: z.number().int().positive(),
  focus: z.string(),
  question_ids: z.array(z.string()),
  minutes: z.number().int().nonnegative(),
});

export const scheduleSchema = z.object({
  days_available: z.number().int().positive(),
  days: z.array(scheduleDaySchema),
});

export const coverageReportSchema = z.object({
  uncovered_requirement_ids: z.array(z.string()),
  passes: z.number().int().nonnegative(),
});

export const appendixAKitSchema = z.object({
  source: kitSourceSchema,
  company_brief: companyBriefSchema,
  role: roleBreakdownSchema,
  questions: z.array(questionSchema),
  flashcards: z.array(flashcardSchema),
  schedule: scheduleSchema,
  coverage: coverageReportSchema,
}).superRefine((data, ctx) => {
  // Verify schedule days count equals days_available
  if (data.schedule.days.length !== data.schedule.days_available) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Schedule days length (${data.schedule.days.length}) does not match days_available (${data.schedule.days_available})`,
      path: ["schedule", "days"],
    });
  }

  // Set of all valid requirement IDs
  const validRequirementIds = new Set(data.role.requirements.map(r => r.id));

  // Verify all question requirement_ids exist
  data.questions.forEach((q, idx) => {
    for (const reqId of q.requirement_ids) {
      if (!validRequirementIds.has(reqId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Question ${q.id} references nonexistent requirement ID: ${reqId}`,
          path: ["questions", idx, "requirement_ids"],
        });
      }
    }
  });

  // Set of all valid question IDs
  const validQuestionIds = new Set(data.questions.map(q => q.id));

  // Verify all schedule question_ids exist
  data.schedule.days.forEach((day, idx) => {
    for (const qId of day.question_ids) {
      if (!validQuestionIds.has(qId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Schedule Day ${day.day} references nonexistent question ID: ${qId}`,
          path: ["schedule", "days", idx, "question_ids"],
        });
      }
    }
  });

  // Verify flashcard requirement IDs if present
  data.flashcards.forEach((f, idx) => {
    for (const reqId of f.requirement_ids) {
      if (!validRequirementIds.has(reqId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Flashcard ${f.id} references nonexistent requirement ID: ${reqId}`,
          path: ["flashcards", idx, "requirement_ids"],
        });
      }
    }
  });
});

// API DTO schemas
export const registerRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().optional(),
});

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const createKitRequestSchema = z.object({
  jd: z.string().min(10, "Job description must be at least 10 characters"),
  company_url: z.string().min(1, "Company URL is required"),
  days: z.number().int().min(1, "Days must be at least 1").max(90, "Days cannot exceed 90"),
});

export const updateQuestionSchema = z.object({
  prompt: z.string().optional(),
  answer_outline: z.string().optional(),
  category: z.enum(["technical", "behavioural", "system-design", "company-fit"]).optional(),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  requirement_ids: z.array(z.string()).optional(),
  pinned: z.boolean().optional(),
});

export const createQuestionSchema = z.object({
  prompt: z.string().min(1),
  answer_outline: z.string().default(""),
  category: z.enum(["technical", "behavioural", "system-design", "company-fit"]),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
  requirement_ids: z.array(z.string()).default([]),
});

export const updateFlashcardSchema = z.object({
  front: z.string().optional(),
  back: z.string().optional(),
  requirement_ids: z.array(z.string()).optional(),
  pinned: z.boolean().optional(),
});

export const createFlashcardSchema = z.object({
  front: z.string().min(1),
  back: z.string().min(1),
  requirement_ids: z.array(z.string()).default([]),
});

export const recordPracticeReviewSchema = z.object({
  cardId: z.string().min(1),
  confidence: z.number().int().min(1).max(5),
});

export const batchCaseSchema = z.object({
  id: z.string(),
  jd: z.string(),
  company_url: z.string(),
  days: z.number().int().positive(),
});

export const batchInputSchema = z.array(batchCaseSchema);
