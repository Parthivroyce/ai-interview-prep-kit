import crypto from "node:crypto";

export function computeKitFingerprint(jd: string, companyUrl: string): string {
  const normJd = jd.toLowerCase().replace(/\s+/g, " ").trim();
  let normUrl = companyUrl.trim().toLowerCase();
  try {
    const u = new URL(normUrl);
    normUrl = `${u.protocol}//${u.hostname}${u.pathname}`.replace(/\/+$/, "");
  } catch {
    // Keep as trimmed lower
  }

  return crypto
    .createHash("sha256")
    .update(`${normUrl}:::${normJd}`)
    .digest("hex");
}
