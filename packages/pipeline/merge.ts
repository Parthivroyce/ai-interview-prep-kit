import { AppendixAKit, Question, QuestionCategory } from "../shared/types";
import { generateDeterministicSchedule } from "../scheduler/scheduler";
import { findUncoveredRequirements } from "./coverage";

/**
 * Merge strategy for regenerating questions in a specific category:
 * - User-edited questions survive regeneration
 * - User-created (manual) questions survive regeneration
 * - Pinned questions survive regeneration
 * - Only untouched generated questions in the target category are replaced
 * - Untargeted categories are completely preserved
 */
export function mergeRegeneratedQuestions(
  existingQuestions: Question[],
  newCategoryQuestions: Question[],
  targetCategory: QuestionCategory
): Question[] {
  const preservedQuestions: Question[] = [];
  const otherCategoryQuestions: Question[] = [];

  for (const q of existingQuestions) {
    if (q.category !== targetCategory) {
      otherCategoryQuestions.push(q);
      continue;
    }

    const isEdited = q._meta?.edited === true;
    const isManual = q._meta?.origin === "manual";
    const isPinned = q._meta?.pinned === true;

    if (isEdited || isManual || isPinned) {
      preservedQuestions.push(q);
    }
  }

  // Ensure IDs of new generated questions do not collide with preserved ones
  const existingIds = new Set(existingQuestions.map(q => q.id));
  let counter = 1;

  const validNewQuestions: Question[] = newCategoryQuestions.map(nq => {
    let candidateId = nq.id;
    while (existingIds.has(candidateId)) {
      candidateId = `q_gen_${counter++}`;
    }
    existingIds.add(candidateId);

    return {
      ...nq,
      id: candidateId,
      _meta: { origin: "generated", edited: false, pinned: false },
    };
  });

  return [...otherCategoryQuestions, ...preservedQuestions, ...validNewQuestions];
}

/**
 * Updates kit schedule and coverage deterministically after question edits or regeneration
 */
export function recalculateKitDerivedState(kit: AppendixAKit): AppendixAKit {
  const uncovered = findUncoveredRequirements(kit.role.requirements, kit.questions);
  const newSchedule = generateDeterministicSchedule(kit.role.requirements, kit.questions, kit.schedule.days_available);

  return {
    ...kit,
    schedule: newSchedule,
    coverage: {
      ...kit.coverage,
      uncovered_requirement_ids: uncovered,
    },
  };
}
