import { CompanyBrief } from "../shared/types";
import { CrawledPage } from "../retrieval/crawler";
import { LlmClient, LlmProvider } from "./llmClient";

export async function generateCompanyBrief(
  companyUrl: string,
  crawledPages: CrawledPage[],
  interviewEvidenceText: string,
  llmProvider: LlmProvider
): Promise<CompanyBrief> {
  const sources = crawledPages.map(p => p.url);

  // If no pages could be crawled
  if (crawledPages.length === 0) {
    return {
      summary: `Information for ${companyUrl} was not retrievable directly from the website.`,
      what_they_do: "Details unavailable due to unreachable or restricted website.",
      sources: [companyUrl],
      _meta: { origin: "generated", edited: false, pinned: false },
    };
  }

  // Aggregate page excerpts
  const contextSnippet = crawledPages
    .slice(0, 5)
    .map(p => `URL: ${p.url}\nTitle: ${p.title}\nContent:\n${p.text.slice(0, 1200)}`)
    .join("\n\n---\n\n");

  const safeContent = LlmClient.formatUntrustedContent("COMPANY_RESEARCH", contextSnippet);

  const prompt = `
Generate a concise, factual Company Brief based ONLY on the provided reference material.
Do NOT fabricate company history, products, or metrics not supported by the evidence.

Return JSON in this format:
{
  "summary": "2-3 sentence overview of the company, mission, and focus.",
  "what_they_do": "Clear factual explanation of their products, services, or business domain."
}

${safeContent}
${interviewEvidenceText ? `\nPublic Interview Discussion notes:\n${interviewEvidenceText}` : ""}
`;

  try {
    const res = await llmProvider.generateJson<{ summary: string; what_they_do: string }>(prompt, {
      systemPrompt: "You are an objective corporate analyst. Return strictly factual summaries based on provided context.",
      temperature: 0.2,
    });

    return {
      summary: res.summary || "Company information extracted from web sources.",
      what_they_do: res.what_they_do || "Products and services outlined on company website.",
      sources,
      _meta: { origin: "generated", edited: false, pinned: false },
    };
  } catch {
    // Offline deterministic fallback
    const firstPage = crawledPages[0];
    const preview = firstPage ? firstPage.text.slice(0, 200).replace(/\s+/g, " ") : "Information extracted from website.";
    return {
      summary: `Overview based on company website (${companyUrl}). ${preview}`,
      what_they_do: preview,
      sources,
      _meta: { origin: "generated", edited: false, pinned: false },
    };
  }
}
