import { runScheduleTests } from "./schedule.test";
import { runCoverageTests } from "./coverage.test";
import { runValidationTests } from "./validation.test";
import { runRegenerationTests } from "./regeneration.test";
import { runFingerprintAndSecurityTests } from "./fingerprint.test";

async function main() {
  console.log("=========================================");
  console.log("RUNNING AI INTERVIEW PREP KIT TEST SUITE");
  console.log("=========================================\n");

  try {
    runScheduleTests();
    console.log();
    runCoverageTests();
    console.log();
    runValidationTests();
    console.log();
    runRegenerationTests();
    console.log();
    runFingerprintAndSecurityTests();
    console.log();

    console.log("=========================================");
    console.log("✓ ALL AUTOMATED TESTS PASSED SUCCESSFULLY");
    console.log("=========================================");
  } catch (err: any) {
    console.error("\n❌ TEST SUITE FAILED:");
    console.error(err);
    process.exit(1);
  }
}

main();
