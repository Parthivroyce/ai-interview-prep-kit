import assert from "node:assert/strict";

const testJd = `Software Development Engineer – Backend

Responsibilities:

* Design, develop, test, and maintain scalable backend services and REST APIs.
* Build reliable services using Java, Spring Boot, and related backend technologies.
* Work with relational and NoSQL databases.
* Develop event-driven services using Kafka.
* Debug production issues and perform root-cause analysis.
* Write unit and integration tests.
* Collaborate with other engineers and participate in code reviews.

Requirements:

* Strong programming fundamentals in Java or another object-oriented language.
* Experience building REST APIs and backend services.
* Understanding of databases, SQL, data modeling, and indexing.
* Familiarity with distributed systems and asynchronous/event-driven architectures.
* Understanding of testing, Git, and debugging.`;

const companyUrl = "https://www.snowflake.com/";
const days = 5;

async function testGeneration() {
  console.log("==================================================");
  console.log("Testing Complete Unauthenticated Generate Kit Flow");
  console.log("Company URL:", companyUrl);
  console.log("Days:", days);
  console.log("==================================================");

  // 1. Send POST /api/kits WITHOUT any auth cookie or Bearer token
  const createRes = await fetch("http://localhost:3000/api/kits", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jd: testJd,
      company_url: companyUrl,
      days,
    }),
  });

  console.log("POST /api/kits Response Status:", createRes.status);
  const createData = await createRes.json();
  console.log("POST /api/kits Response Body:", JSON.stringify(createData, null, 2));

  assert.ok(
    createRes.status === 200 || createRes.status === 202,
    `Expected HTTP 200 or 202, but received ${createRes.status}`
  );
  assert.ok(createData.kitId, "Expected kitId in response");
  assert.ok(createData.kitId !== undefined, "kitId must be valid");

  const kitId = createData.kitId;
  console.log(`\nKit created with ID: ${kitId}. Polling status...`);

  // 2. Poll until completed or failed
  let status = "running";
  let kitData: any = null;
  const startTime = Date.now();
  const maxWaitMs = 120000; // 2 minutes max

  while (Date.now() - startTime < maxWaitMs) {
    const pollRes = await fetch(`http://localhost:3000/api/kits/${kitId}`);
    assert.equal(pollRes.status, 200, `GET /api/kits/${kitId} must return 200`);
    const pollData = await pollRes.json();
    status = pollData.kit.generation.status;
    kitData = pollData.kit;

    console.log(
      ` [${Math.round((Date.now() - startTime) / 1000)}s] Status: ${status} | Step: ${kitData.generation.step} (${kitData.generation.progress}%)`
    );

    if (status === "completed" || status === "failed") {
      break;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }

  assert.equal(status, "completed", `Kit generation should complete, but was ${status}`);
  console.log("\n✓ Kit Generation Pipeline Finished Successfully!");

  // 3. Verify Kit Content
  assert.ok(kitData.company_brief.summary.length > 0, "Company brief must be generated");
  assert.equal(kitData.schedule.days_available, 5, "Schedule days_available must be 5");
  assert.equal(kitData.schedule.days.length, 5, "Schedule days array length must be exactly 5");
  assert.ok(kitData.questions.length >= 4, "Must generate questions across categories");
  assert.ok(kitData.flashcards.length >= 1, "Must generate flashcards");

  console.log("\nKit Overview Summary:");
  console.log("- Role Title:", kitData.role.title);
  console.log("- Seniority:", kitData.role.seniority);
  console.log("- Requirements Count:", kitData.role.requirements.length);
  console.log("- Questions Count:", kitData.questions.length);
  console.log("- Flashcards Count:", kitData.flashcards.length);
  console.log("- Schedule Days Count:", kitData.schedule.days.length);
  console.log("- Coverage Passes:", kitData.coverage.passes);
  console.log("==================================================");
  console.log("ALL VERIFICATIONS PASSED WITHOUT AUTHENTICATION");
  console.log("==================================================");
}

testGeneration().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
