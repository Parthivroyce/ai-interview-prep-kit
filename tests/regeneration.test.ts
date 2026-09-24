import assert from "node:assert/strict";
import { mergeRegeneratedQuestions } from "../packages/pipeline/merge";
import { Question } from "../packages/shared/types";

export function runRegenerationTests(): void {
  console.log("Running Regeneration & State Tests...");

  const existingQuestions: Question[] = [
    {
      id: "q1",
      requirement_ids: ["r1"],
      category: "technical",
      prompt: "Unedited generated technical question 1",
      answer_outline: "...",
      difficulty: 1,
      _meta: { origin: "generated", edited: false, pinned: false },
    },
    {
      id: "q2",
      requirement_ids: ["r1"],
      category: "technical",
      prompt: "User EDITED technical question 2",
      answer_outline: "...",
      difficulty: 2,
      _meta: { origin: "generated", edited: true, pinned: false },
    },
    {
      id: "q3",
      requirement_ids: ["r1"],
      category: "technical",
      prompt: "User PINNED technical question 3",
      answer_outline: "...",
      difficulty: 3,
      _meta: { origin: "generated", edited: false, pinned: true },
    },
    {
      id: "q4",
      requirement_ids: ["r1"],
      category: "technical",
      prompt: "MANUAL custom question 4",
      answer_outline: "...",
      difficulty: 2,
      _meta: { origin: "manual", edited: false, pinned: false },
    },
    {
      id: "q5",
      requirement_ids: ["r2"],
      category: "behavioural",
      prompt: "Behavioural question 5",
      answer_outline: "...",
      difficulty: 1,
      _meta: { origin: "generated", edited: false, pinned: false },
    },
  ];

  const newGeneratedTechnical: Question[] = [
    {
      id: "q_new_1",
      requirement_ids: ["r1"],
      category: "technical",
      prompt: "Brand new generated technical question A",
      answer_outline: "...",
      difficulty: 2,
    },
    {
      id: "q_new_2",
      requirement_ids: ["r1"],
      category: "technical",
      prompt: "Brand new generated technical question B",
      answer_outline: "...",
      difficulty: 3,
    },
  ];

  // Regenerate TECHNICAL category
  const merged = mergeRegeneratedQuestions(existingQuestions, newGeneratedTechnical, "technical");

  // Verify q1 (unedited generated) was replaced
  assert.ok(!merged.some(q => q.id === "q1"), "q1 (untouched generated) should be replaced");

  // Verify q2 (edited) survived
  const q2 = merged.find(q => q.id === "q2");
  assert.ok(q2, "q2 (edited) must survive regeneration");
  assert.equal(q2?.prompt, "User EDITED technical question 2");

  // Verify q3 (pinned) survived
  const q3 = merged.find(q => q.id === "q3");
  assert.ok(q3, "q3 (pinned) must survive regeneration");

  // Verify q4 (manual) survived
  const q4 = merged.find(q => q.id === "q4");
  assert.ok(q4, "q4 (manual) must survive regeneration");

  // Verify q5 (other category: behavioural) was NOT modified or removed
  const q5 = merged.find(q => q.id === "q5");
  assert.ok(q5, "q5 (behavioural category) must be untouched when regenerating technical category");

  // Verify new questions are included
  assert.ok(merged.some(q => q.prompt === "Brand new generated technical question A"), "New generated questions must be present");

  console.log("  ✓ Regeneration preserves edited, pinned, and manual questions");
  console.log("  ✓ Regeneration does not affect un-targeted categories");
}
