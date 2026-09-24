import assert from "node:assert/strict";
import { validateAppendixAKit } from "../packages/shared/appendixA";
import { AppendixAKit } from "../packages/shared/types";

export function runValidationTests(): void {
  console.log("Running Structure Validation Tests...");

  const validKit: AppendixAKit = {
    source: {
      company: "Acme Corp",
      company_url: "https://acme.example.com",
      role: "Staff Backend Engineer",
      location: "Remote",
      jd_chars: 420,
      researched_at: "2026-09-24T12:00:00Z",
      pages_used: ["https://acme.example.com"],
    },
    company_brief: {
      summary: "Acme builds enterprise logistics software.",
      what_they_do: "Global freight routing platform.",
      sources: ["https://acme.example.com"],
    },
    role: {
      title: "Staff Backend Engineer",
      seniority: "Staff",
      responsibilities: ["Architect streaming services"],
      requirements: [
        { id: "r1", text: "Distributed systems", kind: "technical", priority: "must" },
        { id: "r2", text: "Cross-functional leadership", kind: "behavioural", priority: "nice" },
      ],
    },
    questions: [
      {
        id: "q1",
        requirement_ids: ["r1"],
        category: "technical",
        prompt: "Explain event sourcing",
        answer_outline: "Events, snapshots, CQRS",
        difficulty: 2,
      },
    ],
    flashcards: [
      {
        id: "f1",
        front: "What is CQRS?",
        back: "Command Query Responsibility Segregation",
        requirement_ids: ["r1"],
      },
    ],
    schedule: {
      days_available: 1,
      days: [
        {
          day: 1,
          focus: "System Architecture",
          question_ids: ["q1"],
          minutes: 20,
        },
      ],
    },
    coverage: {
      uncovered_requirement_ids: [],
      passes: 1,
    },
  };

  // Test 1: Valid kit succeeds
  const v1 = validateAppendixAKit(validKit);
  assert.equal(v1.success, true, "Valid kit must pass schema validation");
  console.log("  ✓ Valid kit structure passes");

  // Test 2: Missing fields
  const missingFieldKit = JSON.parse(JSON.stringify(validKit));
  delete missingFieldKit.source;
  const v2 = validateAppendixAKit(missingFieldKit);
  assert.equal(v2.success, false);
  console.log("  ✓ Missing fields fail validation");

  // Test 3: Invalid difficulty (difficulty: 4)
  const invalidDiffKit = JSON.parse(JSON.stringify(validKit));
  invalidDiffKit.questions[0].difficulty = 4;
  const v3 = validateAppendixAKit(invalidDiffKit);
  assert.equal(v3.success, false);
  console.log("  ✓ Invalid difficulty fails validation");

  // Test 4: Float minutes
  const floatMinKit = JSON.parse(JSON.stringify(validKit));
  floatMinKit.schedule.days[0].minutes = 15.5;
  const v4 = validateAppendixAKit(floatMinKit);
  assert.equal(v4.success, false);
  console.log("  ✓ Float minutes fail validation");

  // Test 5: Invalid category
  const invalidCatKit = JSON.parse(JSON.stringify(validKit));
  invalidCatKit.questions[0].category = "algos";
  const v5 = validateAppendixAKit(invalidCatKit);
  assert.equal(v5.success, false);
  console.log("  ✓ Invalid category fails validation");

  // Test 6: Invalid priority
  const invalidPrioKit = JSON.parse(JSON.stringify(validKit));
  invalidPrioKit.role.requirements[0].priority = "optional";
  const v6 = validateAppendixAKit(invalidPrioKit);
  assert.equal(v6.success, false);
  console.log("  ✓ Invalid priority fails validation");

  // Test 7: Nonexistent requirement ID in question
  const nonExistentReqKit = JSON.parse(JSON.stringify(validKit));
  nonExistentReqKit.questions[0].requirement_ids = ["r999"];
  const v7 = validateAppendixAKit(nonExistentReqKit);
  assert.equal(v7.success, false);
  console.log("  ✓ Nonexistent requirement ID fails validation");

  // Test 8: Nonexistent question ID in schedule
  const nonExistentQKit = JSON.parse(JSON.stringify(validKit));
  nonExistentQKit.schedule.days[0].question_ids = ["q999"];
  const v8 = validateAppendixAKit(nonExistentQKit);
  assert.equal(v8.success, false);
  console.log("  ✓ Nonexistent question ID fails validation");

  // Test 9: Wrong number of schedule days
  const wrongDaysKit = JSON.parse(JSON.stringify(validKit));
  wrongDaysKit.schedule.days_available = 5; // but only 1 day in array
  const v9 = validateAppendixAKit(wrongDaysKit);
  assert.equal(v9.success, false);
  console.log("  ✓ Wrong number of schedule days fails validation");
}
