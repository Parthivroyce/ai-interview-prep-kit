import { appendixAKitSchema } from "./schemas";
import { AppendixAKit } from "./types";

export function validateAppendixAKit(data: unknown): { success: true; data: AppendixAKit } | { success: false; errors: string[] } {
  const result = appendixAKitSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data as AppendixAKit };
  }
  const errorMessages = result.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`);
  return { success: false, errors: errorMessages };
}

/**
 * Return strict Appendix A object matching Section 5 exactly
 */
export function sanitizeToExactAppendixA(kit: AppendixAKit): AppendixAKit {
  return {
    source: {
      company: kit.source.company || "",
      company_url: kit.source.company_url || "",
      role: kit.source.role || "",
      location: kit.source.location || "",
      jd_chars: Number(kit.source.jd_chars) || 0,
      researched_at: kit.source.researched_at || new Date().toISOString(),
      pages_used: kit.source.pages_used || [],
    },
    company_brief: {
      summary: kit.company_brief.summary || "",
      what_they_do: kit.company_brief.what_they_do || "",
      sources: kit.company_brief.sources || [],
    },
    role: {
      title: kit.role.title || "",
      seniority: kit.role.seniority || "",
      responsibilities: kit.role.responsibilities || [],
      requirements: (kit.role.requirements || []).map(r => ({
        id: r.id,
        text: r.text,
        kind: r.kind,
        priority: r.priority,
      })),
    },
    questions: (kit.questions || []).map(q => ({
      id: q.id,
      requirement_ids: q.requirement_ids || [],
      category: q.category,
      prompt: q.prompt,
      answer_outline: q.answer_outline || "",
      difficulty: q.difficulty,
    })),
    flashcards: (kit.flashcards || []).map(f => ({
      id: f.id,
      front: f.front,
      back: f.back,
      requirement_ids: f.requirement_ids || [],
    })),
    schedule: {
      days_available: Number(kit.schedule.days_available) || 1,
      days: (kit.schedule.days || []).map(d => ({
        day: Number(d.day),
        focus: d.focus || "",
        question_ids: d.question_ids || [],
        minutes: Math.round(Number(d.minutes) || 0),
      })),
    },
    coverage: {
      uncovered_requirement_ids: kit.coverage.uncovered_requirement_ids || [],
      passes: Number(kit.coverage.passes) || 1,
    },
  };
}
