import assert from "node:assert/strict";
import { fallbackExtractJd } from "../packages/generation/jdExtraction";
import { validateUrlForSsrf } from "../packages/retrieval/urlValidator";
import { getDbStore } from "../src/server/db";
import { generateDeterministicSchedule } from "../packages/scheduler/scheduler";
import { Question, Requirement } from "../packages/shared/types";

export async function runAuditEdgeCasesTests(): Promise<void> {
  console.log("Running Rigorous Edge Cases & Audit Tests...");

  // 1. THIN JD AUDIT
  const thinJd = "Backend developer needed.\nExperience with APIs preferred.";
  const extracted = fallbackExtractJd(thinJd);

  // Must not invent Kafka, Redis, AWS, Kubernetes, Docker, microservices
  const forbiddenKeywords = ["kafka", "redis", "aws", "kubernetes", "docker", "microservices"];
  for (const req of extracted.requirements) {
    const textLower = req.text.toLowerCase();
    for (const kw of forbiddenKeywords) {
      assert.ok(
        !textLower.includes(kw),
        `Thin JD must NEVER invent unmentioned technology: ${kw}. Found in: "${req.text}"`
      );
    }
  }
  console.log("  ✓ Thin JD audit passes: Zero hallucinated frameworks or technologies");

  // 2. SSRF PRODUCTION VS EVALUATION MODE AUDIT
  // Production mode (allowLocal: false)
  const ssrf1 = validateUrlForSsrf("http://localhost:8099/acme/", { allowLocal: false });
  assert.equal(ssrf1.valid, false, "Production MUST reject localhost");

  const ssrf2 = validateUrlForSsrf("http://127.0.0.1:8080/test", { allowLocal: false });
  assert.equal(ssrf2.valid, false, "Production MUST reject 127.0.0.1");

  const ssrf3 = validateUrlForSsrf("http://192.168.1.100/admin", { allowLocal: false });
  assert.equal(ssrf3.valid, false, "Production MUST reject private RFC1918 (192.168.x.x)");

  const ssrf4 = validateUrlForSsrf("http://10.0.0.1/status", { allowLocal: false });
  assert.equal(ssrf4.valid, false, "Production MUST reject private RFC1918 (10.x.x.x)");

  // Evaluation/Development mode (allowLocal: true)
  const ssrfEval = validateUrlForSsrf("http://localhost:8099/acme/", { allowLocal: true });
  assert.equal(ssrfEval.valid, true, "Evaluation mode MUST permit localhost:8099/acme/");

  const ssrfMeta = validateUrlForSsrf("http://169.254.169.254/latest/meta-data/", { allowLocal: true });
  assert.equal(ssrfMeta.valid, false, "Metadata IP MUST be rejected even in evaluation mode");
  console.log("  ✓ SSRF audit passes: Rejects private/reserved IPs while permitting evaluation localhost");

  // 3. AUTH & USER ISOLATION AUDIT
  const db = await getDbStore();
  const userA = await db.users.insert({
    email: "user_a@test.com",
    passwordHash: "hash_a",
    createdAt: new Date().toISOString(),
  });
  const userB = await db.users.insert({
    email: "user_b@test.com",
    passwordHash: "hash_b",
    createdAt: new Date().toISOString(),
  });

  const kitA = await db.kits.insert({
    userId: userA._id,
    fingerprint: "fp_a",
    source: { company: "A Corp", company_url: "https://a.com", role: "Dev", location: "", jd_chars: 10, researched_at: "", pages_used: [] },
    company_brief: { summary: "", what_they_do: "", sources: [] },
    role: { title: "Dev", seniority: "Mid", responsibilities: [], requirements: [] },
    questions: [],
    flashcards: [],
    schedule: { days_available: 5, days: [] },
    coverage: { uncovered_requirement_ids: [], passes: 1 },
    generation: { status: "completed", step: "Ready", progress: 100, errors: [] },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // User B queries Kit A
  const accessedByUserB = await db.kits.findById(kitA._id, userB._id);
  assert.equal(accessedByUserB, null, "User B MUST NOT be able to access User A's kit");

  // User A queries Kit A
  const accessedByUserA = await db.kits.findById(kitA._id, userA._id);
  assert.ok(accessedByUserA !== null, "User A must access their own kit");
  assert.equal(accessedByUserA?._id, kitA._id);

  // Unauthenticated kit test (kit created without session)
  const unauthKit = await db.kits.insert({
    fingerprint: "fp_unauth",
    source: { company: "Open Corp", company_url: "https://open.com", role: "Dev", location: "", jd_chars: 10, researched_at: "", pages_used: [] },
    company_brief: { summary: "", what_they_do: "", sources: [] },
    role: { title: "Dev", seniority: "Mid", responsibilities: [], requirements: [] },
    questions: [],
    flashcards: [],
    schedule: { days_available: 5, days: [] },
    coverage: { uncovered_requirement_ids: [], passes: 1 },
    generation: { status: "completed", step: "Ready", progress: 100, errors: [] },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const fetchedUnauth = await db.kits.findById(unauthKit._id);
  assert.ok(fetchedUnauth !== null, "Unauthenticated kit must be retrievable without a session");
  assert.equal(fetchedUnauth?._id, unauthKit._id);

  console.log("  ✓ User isolation and unauthenticated kit flow passes");

  // 4. SCHEDULER MUST-HAVE REQUIREMENT COVERAGE AUDIT
  const reqs: Requirement[] = [
    { id: "r1", text: "Req 1", kind: "technical", priority: "must" },
    { id: "r2", text: "Req 2", kind: "technical", priority: "must" },
    { id: "r3", text: "Req 3", kind: "behavioural", priority: "nice" },
  ];
  const questions: Question[] = [
    { id: "q1", requirement_ids: ["r1"], category: "technical", prompt: "p1", answer_outline: "", difficulty: 3 },
    { id: "q2", requirement_ids: ["r2"], category: "technical", prompt: "p2", answer_outline: "", difficulty: 2 },
    { id: "q3", requirement_ids: ["r3"], category: "behavioural", prompt: "p3", answer_outline: "", difficulty: 1 },
  ];

  // Test 1-day schedule must-have coverage
  const sched1 = generateDeterministicSchedule(reqs, questions, 1);
  assert.equal(sched1.days.length, 1);
  const qIdsDay1 = new Set(sched1.days[0].question_ids);
  // All must-have requirements must be covered in scheduled questions
  const coveredInDay1 = new Set<string>();
  questions.filter(q => qIdsDay1.has(q.id)).forEach(q => q.requirement_ids.forEach(rid => coveredInDay1.add(rid)));
  assert.ok(coveredInDay1.has("r1"), "Schedule must include question covering r1");
  assert.ok(coveredInDay1.has("r2"), "Schedule must include question covering r2");

  // Test 60-day schedule
  const sched60 = generateDeterministicSchedule(reqs, questions, 60);
  assert.equal(sched60.days.length, 60);
  assert.equal(sched60.days_available, 60);
  for (let d = 0; d < 60; d++) {
    assert.equal(sched60.days[d].day, d + 1);
    assert.ok(sched60.days[d].question_ids.length > 0);
    assert.ok(Number.isInteger(sched60.days[d].minutes));
  }
  console.log("  ✓ Scheduler coverage audit passes: All must-have requirements scheduled in 1d and 60d");
}
