import assert from "node:assert/strict";
import { findUncoveredRequirements } from "../packages/pipeline/coverage";
import { Question, Requirement } from "../packages/shared/types";

export function runCoverageTests(): void {
  console.log("Running Coverage Tests...");

  const reqs: Requirement[] = [
    { id: "r1", text: "React & TypeScript", kind: "technical", priority: "must" },
    { id: "r2", text: "GraphQL API", kind: "technical", priority: "must" },
    { id: "r3", text: "Mentorship", kind: "behavioural", priority: "nice" },
  ];

  // Test 1: All must requirements covered
  const fullyCoveredQuestions: Question[] = [
    { id: "q1", requirement_ids: ["r1"], category: "technical", prompt: "...", answer_outline: "...", difficulty: 2 },
    { id: "q2", requirement_ids: ["r2"], category: "technical", prompt: "...", answer_outline: "...", difficulty: 2 },
  ];
  const uncovered1 = findUncoveredRequirements(reqs, fullyCoveredQuestions);
  assert.equal(uncovered1.length, 0, "No must-have requirements should be uncovered");
  console.log("  ✓ All requirements covered passes");

  // Test 2: One missing must requirement
  const oneMissingQuestions: Question[] = [
    { id: "q1", requirement_ids: ["r1"], category: "technical", prompt: "...", answer_outline: "...", difficulty: 2 },
  ];
  const uncovered2 = findUncoveredRequirements(reqs, oneMissingQuestions);
  assert.deepEqual(uncovered2, ["r2"], "r2 must be identified as uncovered");
  console.log("  ✓ One missing must requirement passes");

  // Test 3: Multiple missing must requirements
  const emptyQuestions: Question[] = [];
  const uncovered3 = findUncoveredRequirements(reqs, emptyQuestions);
  assert.deepEqual(uncovered3, ["r1", "r2"], "r1 and r2 must be identified as uncovered");
  console.log("  ✓ Multiple missing requirements passes");

  // Test 4: Nice-to-have requirements do not fail coverage
  // r3 is priority "nice", even without questions covering it, it shouldn't be in uncovered
  const noNiceQuestions: Question[] = [
    { id: "q1", requirement_ids: ["r1"], category: "technical", prompt: "...", answer_outline: "...", difficulty: 2 },
    { id: "q2", requirement_ids: ["r2"], category: "technical", prompt: "...", answer_outline: "...", difficulty: 2 },
  ];
  const uncovered4 = findUncoveredRequirements(reqs, noNiceQuestions);
  assert.ok(!uncovered4.includes("r3"), "Nice-to-have r3 should not fail coverage");
  console.log("  ✓ Nice requirements do not incorrectly fail coverage passes");
}
