import assert from "node:assert/strict";
import { generateDeterministicSchedule, calculateQuestionDuration } from "../packages/scheduler/scheduler";
import { Question, Requirement } from "../packages/shared/types";

export function runScheduleTests(): void {
  console.log("Running Schedule Tests...");

  const sampleRequirements: Requirement[] = [
    { id: "r1", text: "Distributed systems", kind: "technical", priority: "must" },
    { id: "r2", text: "PostgreSQL & indexes", kind: "technical", priority: "must" },
    { id: "r3", text: "Communication with product managers", kind: "behavioural", priority: "nice" },
  ];

  const sampleQuestions: Question[] = [
    {
      id: "q1",
      requirement_ids: ["r1"],
      category: "system-design",
      prompt: "Design distributed lock manager",
      answer_outline: "Raft, consensus, lease times",
      difficulty: 3,
    },
    {
      id: "q2",
      requirement_ids: ["r2"],
      category: "technical",
      prompt: "Explain B-tree vs Hash index in Postgres",
      answer_outline: "Range queries, complexity",
      difficulty: 2,
    },
    {
      id: "q3",
      requirement_ids: ["r3"],
      category: "behavioural",
      prompt: "Tell me about resolving trade-offs with PM",
      answer_outline: "Prioritization and metrics",
      difficulty: 1,
    },
  ];

  // Test 1: One-day schedule
  const s1 = generateDeterministicSchedule(sampleRequirements, sampleQuestions, 1);
  assert.equal(s1.days_available, 1);
  assert.equal(s1.days.length, 1);
  assert.equal(s1.days[0].day, 1);
  assert.ok(s1.days[0].minutes > 0, "Day 1 should have positive integer minutes");
  assert.equal(Number.isInteger(s1.days[0].minutes), true, "Minutes must be integer");
  console.log("  ✓ 1-day schedule passes");

  // Test 2: Five-day schedule
  const s5 = generateDeterministicSchedule(sampleRequirements, sampleQuestions, 5);
  assert.equal(s5.days_available, 5);
  assert.equal(s5.days.length, 5);
  for (let i = 0; i < 5; i++) {
    assert.equal(s5.days[i].day, i + 1);
    assert.equal(Number.isInteger(s5.days[i].minutes), true);
    assert.ok(s5.days[i].question_ids.length > 0, `Day ${i + 1} has questions`);
  }
  console.log("  ✓ 5-day schedule passes");

  // Test 3: Sixty-day schedule
  const s60 = generateDeterministicSchedule(sampleRequirements, sampleQuestions, 60);
  assert.equal(s60.days_available, 60);
  assert.equal(s60.days.length, 60);
  for (let i = 0; i < 60; i++) {
    assert.equal(s60.days[i].day, i + 1);
    assert.equal(Number.isInteger(s60.days[i].minutes), true);
    assert.ok(s60.days[i].question_ids.length > 0, `Day ${i + 1} must reference questions`);
  }
  console.log("  ✓ 60-day schedule passes");

  // Test 4: Must-have requirements scheduled
  const allScheduledQuestionIds = new Set<string>();
  s5.days.forEach(d => d.question_ids.forEach(qid => allScheduledQuestionIds.add(qid)));
  const scheduledReqIds = new Set<string>();
  sampleQuestions
    .filter(q => allScheduledQuestionIds.has(q.id))
    .forEach(q => q.requirement_ids.forEach(rid => scheduledReqIds.add(rid)));

  assert.ok(scheduledReqIds.has("r1"), "Must-have requirement r1 must be scheduled");
  assert.ok(scheduledReqIds.has("r2"), "Must-have requirement r2 must be scheduled");
  console.log("  ✓ Must-have requirements are scheduled");

  // Test 5: Valid question references
  const validQuestionIds = new Set(sampleQuestions.map(q => q.id));
  for (const day of s60.days) {
    for (const qId of day.question_ids) {
      assert.ok(validQuestionIds.has(qId), `Question ID ${qId} must reference a valid question`);
    }
  }
  console.log("  ✓ All scheduled question references are valid");

  // Test 6: Duration mapping
  assert.equal(calculateQuestionDuration(1), 10);
  assert.equal(calculateQuestionDuration(2), 20);
  assert.equal(calculateQuestionDuration(3), 30);
  console.log("  ✓ Question duration mapping is deterministic integers");
}
