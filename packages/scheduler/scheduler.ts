import { DifficultyLevel, Question, Requirement, Schedule, ScheduleDay } from "../shared/types";

export const DURATION_BY_DIFFICULTY: Record<DifficultyLevel, number> = {
  1: 10,
  2: 20,
  3: 30,
};

export function calculateQuestionDuration(difficulty: DifficultyLevel): number {
  return DURATION_BY_DIFFICULTY[difficulty] || 20;
}

export function scoreQuestionPriority(question: Question, requirementMap: Map<string, Requirement>): number {
  let score = question.difficulty * 10; // diff 3 = 30, diff 2 = 20, diff 1 = 10

  for (const reqId of question.requirement_ids) {
    const req = requirementMap.get(reqId);
    if (req) {
      if (req.priority === "must") {
        score += 50;
      } else {
        score += 10;
      }
    }
  }

  return score;
}

export function generateDeterministicSchedule(
  requirements: Requirement[],
  questions: Question[],
  daysRequested: number
): Schedule {
  const safeDays = Math.max(1, Math.floor(daysRequested));

  if (questions.length === 0) {
    const emptyDays: ScheduleDay[] = [];
    for (let d = 1; d <= safeDays; d++) {
      emptyDays.push({
        day: d,
        focus: `Day ${d}: General Preparation & Overview`,
        question_ids: [],
        minutes: 0,
      });
    }
    return {
      days_available: safeDays,
      days: emptyDays,
    };
  }

  const reqMap = new Map<string, Requirement>();
  for (const r of requirements) {
    reqMap.set(r.id, r);
  }

  // Score and sort questions (highest priority first: must-have + high difficulty first)
  const scoredQuestions = [...questions].map(q => ({
    question: q,
    score: scoreQuestionPriority(q, reqMap),
    duration: calculateQuestionDuration(q.difficulty),
  }));

  scoredQuestions.sort((a, b) => b.score - a.score);

  // Initialize day buckets
  const days: ScheduleDay[] = [];
  const dayQuestionBuckets: Question[][] = Array.from({ length: safeDays }, () => []);

  // Strategy for allocating questions:
  // If safeDays <= questions.length: distribute questions into buckets
  if (safeDays <= scoredQuestions.length) {
    // Distribute sorted questions across the days to balance workload
    scoredQuestions.forEach((sq, idx) => {
      // Direct early questions to early days
      const targetDay = Math.min(safeDays - 1, Math.floor((idx / scoredQuestions.length) * safeDays));
      dayQuestionBuckets[targetDay].push(sq.question);
    });
  } else {
    // safeDays > questions.length (e.g. 60 days, 10 questions)
    // Initial pass: 1 question per day for first questions.length days
    scoredQuestions.forEach((sq, idx) => {
      dayQuestionBuckets[idx].push(sq.question);
    });

    // For remaining days (questions.length to safeDays - 1):
    // Distribute spaced repetition / mock drills cycling through high priority questions
    for (let d = scoredQuestions.length; d < safeDays; d++) {
      // Pick cycling question prioritizing highest score
      const pick = scoredQuestions[d % scoredQuestions.length].question;
      dayQuestionBuckets[d].push(pick);
    }
  }

  // Ensure every day has valid questions and compute focus & integer minutes
  for (let d = 1; d <= safeDays; d++) {
    const bucket = dayQuestionBuckets[d - 1];

    // If a bucket is empty (rare edge case), borrow top question
    if (bucket.length === 0) {
      bucket.push(scoredQuestions[0].question);
    }

    const questionIds = bucket.map(q => q.id);
    const totalMinutes = bucket.reduce((sum, q) => sum + calculateQuestionDuration(q.difficulty), 0);

    // Formulate a clean, descriptive focus theme
    const categories = Array.from(new Set(bucket.map(q => q.category)));
    const catLabel = categories.map(c => c.replace("-", " ")).join(" & ");

    let focus = `Day ${d}: ${catLabel.charAt(0).toUpperCase() + catLabel.slice(1)} Mastery`;
    if (d === safeDays && safeDays > 3) {
      focus = `Day ${d}: Final Review & Mock Rehearsal`;
    } else if (d === 1) {
      focus = `Day 1: Foundations & Core Architecture`;
    }

    days.push({
      day: d,
      focus,
      question_ids: questionIds,
      minutes: Math.round(totalMinutes),
    });
  }

  return {
    days_available: safeDays,
    days,
  };
}
