import assert from "node:assert/strict";
import { computeKitFingerprint } from "../packages/pipeline/fingerprint";
import { validateUrlForSsrf } from "../packages/retrieval/urlValidator";

export function runFingerprintAndSecurityTests(): void {
  console.log("Running Fingerprint & Security Tests...");

  // Duplicate fingerprint test
  const jd1 = "Senior Backend Engineer. We need distributed systems experience and Go.";
  const jd2 = "  Senior Backend   Engineer. We need distributed systems experience and Go. \n ";
  const url1 = "https://example.com/careers/";
  const url2 = "https://example.com/careers";

  const fp1 = computeKitFingerprint(jd1, url1);
  const fp2 = computeKitFingerprint(jd2, url2);
  assert.equal(fp1, fp2, "Normalized JD and URL must generate identical fingerprints");
  console.log("  ✓ Duplicate detection fingerprinting matches normalized inputs");

  // SSRF tests
  const publicUrl = validateUrlForSsrf("https://example.com/about", { allowLocal: false });
  assert.equal(publicUrl.valid, true);

  const localBlocked = validateUrlForSsrf("http://127.0.0.1:8080/secret", { allowLocal: false });
  assert.equal(localBlocked.valid, false, "Localhost should be blocked when allowLocal is false");

  const localAllowed = validateUrlForSsrf("http://localhost:8099/acme/", { allowLocal: true });
  assert.equal(localAllowed.valid, true, "Localhost should be permitted when allowLocal is true (evaluator mode)");

  const metadataBlocked = validateUrlForSsrf("http://169.254.169.254/computeMetadata/v1/", { allowLocal: true });
  assert.equal(metadataBlocked.valid, false, "Cloud metadata IP should always be blocked");

  console.log("  ✓ SSRF and evaluation mode URL validation passes");
}
