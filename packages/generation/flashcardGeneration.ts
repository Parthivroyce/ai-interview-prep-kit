import { Flashcard, Requirement } from "../shared/types";
import { LlmClient, LlmProvider } from "./llmClient";

interface RawGeneratedFlashcard {
  front: string;
  back: string;
  requirement_ids: string[];
}

export async function generateFlashcards(
  requirements: Requirement[],
  roleTitle: string,
  llmProvider: LlmProvider
): Promise<Flashcard[]> {
  if (requirements.length === 0) return [];

  const reqCatalog = requirements
    .map(r => `ID: ${r.id} | Kind: ${r.kind} | Requirement: ${r.text}`)
    .join("\n");

  const prompt = `
Generate concise, high-yield flashcards for interview prep for the role "${roleTitle}".
Front: Question or concept prompt.
Back: Crisp, memorable bullet points or answer key.
requirement_ids: Must be an array of 1 or more IDs from the requirements catalog below.

REQUIREMENTS CATALOG:
${reqCatalog}

Generate 4 to 8 flashcards. Return JSON:
{
  "flashcards": [
    {
      "front": "What is...",
      "back": "Key concepts...",
      "requirement_ids": ["r1"]
    }
  ]
}
`;

  try {
    const res = await llmProvider.generateJson<{ flashcards: RawGeneratedFlashcard[] }>(prompt, {
      systemPrompt: "You are an expert tutor creating study flashcards.",
      temperature: 0.2,
    });

    const validReqIds = new Set(requirements.map(r => r.id));
    const fallbackId = requirements[0]?.id || "r1";

    const flashcards: Flashcard[] = (res.flashcards || []).map((f, idx) => {
      const matchedIds = (f.requirement_ids || []).filter(id => validReqIds.has(id));
      return {
        id: `f${idx + 1}`,
        front: f.front || "Concept review",
        back: f.back || "Answer review",
        requirement_ids: matchedIds.length > 0 ? matchedIds : [fallbackId],
        _meta: { origin: "generated", edited: false, pinned: false },
      };
    });

    if (flashcards.length > 0) {
      return flashcards;
    }
  } catch {
    // Continue to fallback
  }

  // Deterministic fallback
  return requirements.slice(0, 5).map((req, idx) => ({
    id: `f${idx + 1}`,
    front: `What are the core principles and trade-offs of ${req.text}?`,
    back: `Key focus: Architecture, operational limits, best practices, and error handling for ${req.text}.`,
    requirement_ids: [req.id],
    _meta: { origin: "generated", edited: false, pinned: false },
  }));
}
