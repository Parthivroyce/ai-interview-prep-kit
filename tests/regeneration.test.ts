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

  // PHASE 12 EXACT SCENARIO AUDIT:
  // q1..q5 generated. Edit q3, pin q4, manual q6. Regenerate technical.
  const phase12Questions: Question[] = [
    { id: "q1", requirement_ids: ["r1"], category: "technical", prompt: "q1 prompt", answer_outline: "", difficulty: 1, _meta: { origin: "generated", edited: false, pinned: false } },
    { id: "q2", requirement_ids: ["r1"], category: "technical", prompt: "q2 prompt", answer_outline: "", difficulty: 1, _meta: { origin: "generated", edited: false, pinned: false } },
    { id: "q3", requirement_ids: ["r1"], category: "technical", prompt: "q3 prompt (EDITED)", answer_outline: "", difficulty: 2, _meta: { origin: "generated", edited: true, pinned: false } },
    { id: "q4", requirement_ids: ["r1"], category: "technical", prompt: "q4 prompt (PINNED)", answer_outline: "", difficulty: 2, _meta: { origin: "generated", edited: false, pinned: true } },
    { id: "q5", requirement_ids: ["r1"], category: "technical", prompt: "q5 prompt", answer_outline: "", difficulty: 1, _meta: { origin: "generated", edited: false, pinned: false } },
    { id: "q6", requirement_ids: ["r1"], category: "technical", prompt: "q6 prompt (MANUAL)", answer_outline: "", difficulty: 3, _meta: { origin: "manual", edited: false, pinned: false } },
  ];

  const freshlyGenerated: Question[] = [
    { id: "q_gen_a", requirement_ids: ["r1"], category: "technical", prompt: "fresh question A", answer_outline: "", difficulty: 2 },
    { id: "q_gen_b", requirement_ids: ["r1"], category: "technical", prompt: "fresh question B", answer_outline: "", difficulty: 2 },
  ];

  const phase12Merged = mergeRegeneratedQuestions(phase12Questions, freshlyGenerated, "technical");

  // Verify q3 survives
  assert.ok(phase12Merged.some(q => q.id === "q3" && q.prompt === "q3 prompt (EDITED)"), "q3 (edited) must survive");
  // Verify q4 survives
  assert.ok(phase12Merged.some(q => q.id === "q4" && q._meta?.pinned === true), "q4 (pinned) must survive");
  // Verify q6 survives
  assert.ok(phase12Merged.some(q => q.id === "q6" && q._meta?.origin === "manual"), "q6 (manual) must survive");
  // Verify untouched generated q1, q2, q5 were replaced
  assert.ok(!phase12Merged.some(q => q.id === "q1"), "untouched q1 should be replaced");
  assert.ok(!phase12Merged.some(q => q.id === "q2"), "untouched q2 should be replaced");
  assert.ok(!phase12Merged.some(q => q.id === "q5"), "untouched q5 should be replaced");

  console.log("  ✓ Phase 12 exact scenario passes: q3, q4, q6 survive and untouched questions are replaced");
}
