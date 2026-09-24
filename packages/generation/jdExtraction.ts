import { Requirement, RoleBreakdown } from "../shared/types";
import { LlmClient, LlmProvider } from "./llmClient";

export interface JdExtractionResult {
  title: string;
  seniority: string;
  location: string;
  responsibilities: string[];
  requirements: Requirement[];
}

export async function extractJdRequirements(
  jdText: string,
  llmProvider: LlmProvider
): Promise<JdExtractionResult> {
  const safeJd = LlmClient.formatUntrustedContent("JOB_DESCRIPTION", jdText);

  const prompt = `
Analyze the following Job Description (JD).
CRITICAL RULES:
1. Requirements and responsibilities must be grounded STRICTLY in the provided text.
2. DO NOT INVENT or extrapolate technologies, years of experience, tools, or frameworks not mentioned in the JD.
3. If the JD is very short (e.g. 2 lines), return only what is explicitly written. A thin JD must produce a correspondingly thin set of requirements.
4. Categorize requirement 'kind' into exactly one of: "technical", "behavioural", "domain".
5. Categorize requirement 'priority' into: "must" (core requirement) or "nice" (preferred, optional, plus).
6. Assign stable IDs to requirements starting from r1, r2, r3, etc.

Return JSON in this exact shape:
{
  "title": "Extracted role title or default",
  "seniority": "e.g. Junior, Mid, Senior, Lead, Staff, or Not specified",
  "location": "e.g. Remote, City, or Not specified",
  "responsibilities": ["list", "of", "responsibilities"],
  "requirements": [
    {
      "id": "r1",
      "text": "Explicit requirement from text",
      "kind": "technical",
      "priority": "must"
    }
  ]
}

${safeJd}
`;

  try {
    const res = await llmProvider.generateJson<JdExtractionResult>(prompt, {
      systemPrompt: "You are an accurate JD parser. Never hallucinate skills or technologies not present in the input text.",
      temperature: 0.1,
    });

    // Ensure requirements have valid IDs and defaults
    const requirements: Requirement[] = (res.requirements || []).map((r, idx) => ({
      id: r.id || `r${idx + 1}`,
      text: r.text || "Requirement",
      kind: (r.kind === "technical" || r.kind === "behavioural" || r.kind === "domain") ? r.kind : "technical",
      priority: (r.priority === "must" || r.priority === "nice") ? r.priority : "must",
      _meta: { origin: "generated", edited: false, pinned: false },
    }));

    // If somehow 0 requirements were extracted but text exists, extract at least 1 grounded requirement
    if (requirements.length === 0 && jdText.trim().length > 0) {
      requirements.push({
        id: "r1",
        text: jdText.slice(0, 100).trim(),
        kind: "technical",
        priority: "must",
        _meta: { origin: "generated", edited: false, pinned: false },
      });
    }

    return {
      title: res.title || "Software Engineer",
      seniority: res.seniority || "Not specified",
      location: res.location || "Not specified",
      responsibilities: res.responsibilities || [],
      requirements,
    };
  } catch (err) {
    // Offline deterministic fallback for tests or missing LLM key
    return fallbackExtractJd(jdText);
  }
}

export function fallbackExtractJd(jdText: string): JdExtractionResult {
  const lines = jdText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const title = lines[0] ? lines[0].replace(/^#+\s*/, "").slice(0, 80) : "Software Engineer";
  
  let seniority = "Not specified";
  const lower = jdText.toLowerCase();
  if (lower.includes("senior") || lower.includes("sr.")) seniority = "Senior";
  else if (lower.includes("lead")) seniority = "Lead";
  else if (lower.includes("staff") || lower.includes("principal")) seniority = "Staff";
  else if (lower.includes("junior") || lower.includes("jr.")) seniority = "Junior";
  else if (lower.includes("mid-level") || lower.includes("mid level")) seniority = "Mid";

  const requirements: Requirement[] = [];
  let reqIdx = 1;

  for (const line of lines.slice(1)) {
    const clean = line.replace(/^[-*•\d.]\s*/, "").trim();
    if (clean.length > 5 && clean.length < 200) {
      const isNice = clean.toLowerCase().includes("preferred") || clean.toLowerCase().includes("plus") || clean.toLowerCase().includes("nice to have");
      const isBehavioural = clean.toLowerCase().includes("communication") || clean.toLowerCase().includes("team") || clean.toLowerCase().includes("collaborat");
      requirements.push({
        id: `r${reqIdx++}`,
        text: clean,
        kind: isBehavioural ? "behavioural" : "technical",
        priority: isNice ? "nice" : "must",
        _meta: { origin: "generated", edited: false, pinned: false },
      });
    }
    if (requirements.length >= 8) break;
  }

  if (requirements.length === 0) {
    requirements.push({
      id: "r1",
      text: jdText.trim().slice(0, 100),
      kind: "technical",
      priority: "must",
      _meta: { origin: "generated", edited: false, pinned: false },
    });
  }

  return {
    title,
    seniority,
    location: "Not specified",
    responsibilities: lines.slice(1, 4),
    requirements,
  };
}
