import { DifficultyLevel, Question, QuestionCategory, Requirement } from "../shared/types";
import { LlmClient, LlmProvider } from "./llmClient";

interface RawGeneratedQuestion {
  requirement_ids: string[];
  prompt: string;
  answer_outline: string;
  difficulty: number;
}

export async function generateCategoryQuestions(
  category: QuestionCategory,
  requirements: Requirement[],
  roleTitle: string,
  companyBriefText: string,
  interviewEvidenceText: string,
  llmProvider: LlmProvider,
  startIndex: number = 1
): Promise<Question[]> {
  // Filter requirements that are most relevant to this category to anchor prompt
  let targetReqs = requirements;
  if (category === "technical") {
    targetReqs = requirements.filter(r => r.kind === "technical" || r.kind === "domain");
  } else if (category === "behavioural") {
    targetReqs = requirements.filter(r => r.kind === "behavioural");
    // If no behavioural requirements, allow general role context
    if (targetReqs.length === 0) targetReqs = requirements.slice(0, 3);
  } else if (category === "system-design") {
    targetReqs = requirements.filter(r => r.kind === "technical" || r.kind === "domain");
    if (targetReqs.length === 0) targetReqs = requirements.slice(0, 3);
  } else if (category === "company-fit") {
    targetReqs = requirements;
  }

  const reqCatalog = requirements
    .map(r => `ID: ${r.id} | Kind: ${r.kind} | Priority: ${r.priority} | Requirement: ${r.text}`)
    .join("\n");

  const safeCompany = LlmClient.formatUntrustedContent("COMPANY_CONTEXT", companyBriefText);

  let categoryGuidance = "";
  if (category === "technical") {
    categoryGuidance = "Focus on technical depth, core algorithms, data structures, implementation specifics, code reasoning, or technologies mentioned in the requirements.";
  } else if (category === "behavioural") {
    categoryGuidance = "Focus on leadership, past conflict resolution, teamwork, ownership, communication, and situational judgment using the STAR method.";
  } else if (category === "system-design") {
    categoryGuidance = "Focus on high-level architecture, scalability, reliability, trade-offs, APIs, data modeling, and failure scenarios.";
  } else if (category === "company-fit") {
    categoryGuidance = "Focus on alignment with the company's domain, product challenges, engineering values, and genuine interest based on company context.";
  }

  const prompt = `
You are generating ${category.toUpperCase()} interview questions for a "${roleTitle}" role.
${categoryGuidance}

REQUIREMENTS CATALOG:
${reqCatalog}

${safeCompany}
${interviewEvidenceText ? `\nINTERVIEW EVIDENCE:\n${interviewEvidenceText}` : ""}

CRITICAL CONSTRAINTS:
1. Generate between 2 and 4 realistic, challenging interview questions.
2. Every question's "requirement_ids" field MUST be an array containing 1 or more IDs strictly from the REQUIREMENTS CATALOG above (e.g. ["r1"]).
3. "difficulty" MUST be an integer: 1 (easy/straightforward), 2 (standard/intermediate), or 3 (hard/advanced).
4. Provide a structured "answer_outline" with key points a strong candidate must cover.

Return JSON in this format:
{
  "questions": [
    {
      "requirement_ids": ["r1"],
      "prompt": "Interview question text",
      "answer_outline": "Key points expected in response",
      "difficulty": 2
    }
  ]
}
`;

  try {
    const res = await llmProvider.generateJson<{ questions: RawGeneratedQuestion[] }>(prompt, {
      systemPrompt: `You are a principal technical interviewer creating ${category} questions. Every requirement ID referenced MUST exist in the provided list.`,
      temperature: 0.2,
    });

    const validReqIds = new Set(requirements.map(r => r.id));
    const fallbackId = requirements[0]?.id || "r1";

    const questions: Question[] = (res.questions || []).map((q, idx) => {
      // Validate and clean requirement_ids
      const matchedIds = (q.requirement_ids || []).filter(id => validReqIds.has(id));
      const finalIds = matchedIds.length > 0 ? matchedIds : [fallbackId];

      const diff: DifficultyLevel = q.difficulty === 1 || q.difficulty === 2 || q.difficulty === 3 ? (q.difficulty as DifficultyLevel) : 2;

      return {
        id: `q${startIndex + idx}`,
        requirement_ids: finalIds,
        category,
        prompt: q.prompt || `${category} interview prompt for ${roleTitle}`,
        answer_outline: q.answer_outline || "Candidate should demonstrate practical knowledge and trade-off analysis.",
        difficulty: diff,
        _meta: { origin: "generated", edited: false, pinned: false },
      };
    });

    if (questions.length > 0) {
      return questions;
    }
  } catch {
    // Continue to fallback
  }

  // Offline deterministic fallback
  return fallbackGenerateCategoryQuestions(category, requirements, roleTitle, startIndex);
}

function fallbackGenerateCategoryQuestions(
  category: QuestionCategory,
  requirements: Requirement[],
  roleTitle: string,
  startIndex: number
): Question[] {
  const req = requirements[0] || { id: "r1", text: "Core technical competence", kind: "technical", priority: "must" };
  const targetReq = requirements.find(r => (category === "behavioural" ? r.kind === "behavioural" : r.kind === "technical")) || req;

  if (category === "technical") {
    return [
      {
        id: `q${startIndex}`,
        requirement_ids: [targetReq.id],
        category: "technical",
        prompt: `Explain how you apply ${targetReq.text} in production, discussing memory, concurrency, and performance considerations.`,
        answer_outline: `1. Core architectural concepts.\n2. Concurrency and performance patterns.\n3. Common failure modes and debugging strategies.`,
        difficulty: 2,
        _meta: { origin: "generated", edited: false, pinned: false },
      },
    ];
  } else if (category === "behavioural") {
    return [
      {
        id: `q${startIndex}`,
        requirement_ids: [targetReq.id],
        category: "behavioural",
        prompt: `Describe a situation in your previous work where you faced conflicting deadlines while working on ${targetReq.text}. How did you prioritize?`,
        answer_outline: `STAR response: Situation, Task, Action taken with stakeholders, Result and key learnings.`,
        difficulty: 2,
        _meta: { origin: "generated", edited: false, pinned: false },
      },
    ];
  } else if (category === "system-design") {
    return [
      {
        id: `q${startIndex}`,
        requirement_ids: [targetReq.id],
        category: "system-design",
        prompt: `Design a scalable service handling high-throughput requests related to ${targetReq.text}. How do you ensure high availability and data consistency?`,
        answer_outline: `1. System requirements and load estimation.\n2. API contracts and storage schema.\n3. Caching, partitioning, and failover design.`,
        difficulty: 3,
        _meta: { origin: "generated", edited: false, pinned: false },
      },
    ];
  } else {
    return [
      {
        id: `q${startIndex}`,
        requirement_ids: [targetReq.id],
        category: "company-fit",
        prompt: `Why are you excited to contribute to this role as a ${roleTitle}, and how do your technical principles match the engineering culture?`,
        answer_outline: `1. Alignment with engineering values.\n2. Excitement for company problem domain.\n3. Growth mindset and mutual fit.`,
        difficulty: 1,
        _meta: { origin: "generated", edited: false, pinned: false },
      },
    ];
  }
}

/**
 * Step 15: Missing Question Generation for uncovered must-have requirements
 */
export async function generateQuestionsForUncovered(
  uncoveredReqs: Requirement[],
  roleTitle: string,
  llmProvider: LlmProvider,
  startIndex: number
): Promise<Question[]> {
  if (uncoveredReqs.length === 0) return [];

  const questions: Question[] = [];
  let currentIndex = startIndex;

  for (const req of uncoveredReqs) {
    const category: QuestionCategory = req.kind === "behavioural" ? "behavioural" : "technical";
    const prompt = `
Create an interview question specifically targeting this uncovered must-have requirement for a ${roleTitle}:
Requirement ID: ${req.id}
Requirement: ${req.text}
Kind: ${req.kind}

CRITICAL:
1. The question's requirement_ids MUST be ["${req.id}"].
2. Category must be "${category}".
3. Difficulty must be 1, 2, or 3.

Return JSON:
{
  "prompt": "Question text",
  "answer_outline": "Key points expected",
  "difficulty": 2
}
`;

    try {
      const res = await llmProvider.generateJson<{ prompt: string; answer_outline: string; difficulty: number }>(prompt, {
        systemPrompt: "You are a focused technical interviewer generating a question for a specific requirement.",
        temperature: 0.1,
      });

      const diff: DifficultyLevel = res.difficulty === 1 || res.difficulty === 2 || res.difficulty === 3 ? (res.difficulty as DifficultyLevel) : 2;

      questions.push({
        id: `q${currentIndex++}`,
        requirement_ids: [req.id],
        category,
        prompt: res.prompt || `Deep dive: How do you address ${req.text} in practice?`,
        answer_outline: res.answer_outline || "Candidate outlines comprehensive approach and trade-offs.",
        difficulty: diff,
        _meta: { origin: "generated", edited: false, pinned: false },
      });
    } catch {
      // Deterministic fallback
      questions.push({
        id: `q${currentIndex++}`,
        requirement_ids: [req.id],
        category,
        prompt: `How have you demonstrated mastery in ${req.text} in your past production systems?`,
        answer_outline: `1. Core mechanics.\n2. Real-world edge cases.\n3. Verification and monitoring.`,
        difficulty: 2,
        _meta: { origin: "generated", edited: false, pinned: false },
      });
    }
  }

  return questions;
}
