import { AppendixAKit, GenerationProgress, Question } from "../shared/types";
import { validateAppendixAKit, sanitizeToExactAppendixA } from "../shared/appendixA";
import { CompanyCrawler, CrawledPage } from "../retrieval/crawler";
import { PublicInterviewResearchService } from "../retrieval/interviewResearch";
import { LlmClient, LlmProvider } from "../generation/llmClient";
import { extractJdRequirements } from "../generation/jdExtraction";
import { generateCompanyBrief } from "../generation/companyBrief";
import {
  generateCategoryQuestions,
  generateQuestionsForUncovered,
} from "../generation/questionGeneration";
import { generateFlashcards } from "../generation/flashcardGeneration";
import { findUncoveredRequirements } from "./coverage";
import { generateDeterministicSchedule } from "../scheduler/scheduler";
import { validateUrlForSsrf } from "../retrieval/urlValidator";

export interface PipelineOptions {
  jd: string;
  company_url: string;
  days: number;
  onProgress?: (progress: GenerationProgress) => void;
  llmProvider?: LlmProvider;
  allowLocal?: boolean;
}

export interface PipelineResult {
  kit: AppendixAKit;
  errors: string[];
  warnings: string[];
}

export async function runGenerationPipeline(options: PipelineOptions): Promise<PipelineResult> {
  const { jd, company_url, days } = options;
  const allowLocal = options.allowLocal ?? (process.env.NODE_ENV !== "production" || process.env.ALLOW_LOCAL_URLS === "true");
  const llm = options.llmProvider || new LlmClient();
  const errors: string[] = [];
  const warnings: string[] = [];

  const updateProgress = (step: string, progress: number) => {
    if (options.onProgress) {
      options.onProgress({
        status: "running",
        step,
        progress,
        errors,
      });
    }
  };

  // STEP 1: Extract JD requirements
  updateProgress("Extracting requirements from job description", 5);
  const jdExtraction = await extractJdRequirements(jd, llm);
  const requirements = jdExtraction.requirements;

  // STEP 2 & 3: Crawl company website and rank pages
  updateProgress("Crawling company website", 15);
  const urlCheck = validateUrlForSsrf(company_url, { allowLocal });
  let crawledPages: CrawledPage[] = [];
  let pagesUsed: string[] = [];

  if (!urlCheck.valid) {
    warnings.push(`URL warning: ${urlCheck.error || "Invalid URL"}`);
  } else {
    try {
      const crawler = new CompanyCrawler({
        maxPages: 8,
        maxDepth: 2,
        timeoutMs: 7000,
        allowLocal,
      });
      const crawlResult = await crawler.crawl(company_url);
      crawledPages = crawlResult.pages;
      pagesUsed = crawlResult.pagesUsed;
      if (crawlResult.errors.length > 0) {
        warnings.push(...crawlResult.errors);
      }
    } catch (e: any) {
      warnings.push(`Crawler encountered an issue: ${e.message}`);
    }
  }

  // STEP 4 & 5: Find hiring / interview information on company site
  updateProgress("Analyzing hiring and culture information", 25);
  const hiringPages = crawledPages.filter(p =>
    /interview|hiring|career|culture|values|engineering/i.test(p.url + " " + p.title)
  );

  // STEP 6: Public interview research
  updateProgress("Researching public interview discussions", 35);
  let interviewEvidenceSummary = "";
  try {
    const researchService = new PublicInterviewResearchService();
    // Guess company name from URL hostname or JD title
    const hostname = urlCheck.url?.hostname || company_url;
    const companyNameGuess = hostname.replace(/^(www\.|m\.)/, "").split(".")[0] || "Company";
    const interviewData = await researchService.searchInterviewData(companyNameGuess);
    interviewEvidenceSummary = interviewData.summaryNote;
  } catch (e: any) {
    interviewEvidenceSummary = "Public interview search skipped or unavailable.";
  }

  // STEP 7: Generate company brief
  updateProgress("Synthesizing company brief", 45);
  const companyBrief = await generateCompanyBrief(company_url, crawledPages, interviewEvidenceSummary, llm);

  // STEP 8: Generate role breakdown
  updateProgress("Structuring role breakdown", 50);
  const roleBreakdown = {
    title: jdExtraction.title,
    seniority: jdExtraction.seniority,
    responsibilities: jdExtraction.responsibilities,
    requirements,
    _meta: { origin: "generated" as const, edited: false, pinned: false },
  };

  // STEP 9: Generate TECHNICAL questions separately
  updateProgress("Generating technical questions", 60);
  const technicalQuestions = await generateCategoryQuestions(
    "technical",
    requirements,
    roleBreakdown.title,
    companyBrief.summary,
    interviewEvidenceSummary,
    llm,
    1
  );

  // STEP 10: Generate BEHAVIOURAL questions separately
  updateProgress("Generating behavioural questions", 68);
  const behaviouralQuestions = await generateCategoryQuestions(
    "behavioural",
    requirements,
    roleBreakdown.title,
    companyBrief.summary,
    interviewEvidenceSummary,
    llm,
    technicalQuestions.length + 1
  );

  // STEP 11: Generate SYSTEM-DESIGN questions separately
  updateProgress("Generating system design questions", 75);
  const systemDesignQuestions = await generateCategoryQuestions(
    "system-design",
    requirements,
    roleBreakdown.title,
    companyBrief.summary,
    interviewEvidenceSummary,
    llm,
    technicalQuestions.length + behaviouralQuestions.length + 1
  );

  // STEP 12: Generate COMPANY-FIT questions separately
  updateProgress("Generating company fit questions", 82);
  const companyFitQuestions = await generateCategoryQuestions(
    "company-fit",
    requirements,
    roleBreakdown.title,
    companyBrief.summary,
    interviewEvidenceSummary,
    llm,
    technicalQuestions.length + behaviouralQuestions.length + systemDesignQuestions.length + 1
  );

  let allQuestions: Question[] = [
    ...technicalQuestions,
    ...behaviouralQuestions,
    ...systemDesignQuestions,
    ...companyFitQuestions,
  ];

  // STEP 13: Generate flashcards
  updateProgress("Generating study flashcards", 88);
  const flashcards = await generateFlashcards(requirements, roleBreakdown.title, llm);

  // STEP 14: Run deterministic coverage checker (Pass 1)
  updateProgress("Checking requirement coverage (Pass 1)", 90);
  let uncoveredIds = findUncoveredRequirements(requirements, allQuestions);
  let passes = 1;

  // STEP 15 & 16: Generate questions for uncovered requirements (up to 3 passes)
  while (uncoveredIds.length > 0 && passes < 3) {
    passes++;
    updateProgress(`Generating missing questions for uncovered requirements (Pass ${passes})`, 92);
    const uncoveredReqObjects = requirements.filter(r => uncoveredIds.includes(r.id));
    const newMissingQuestions = await generateQuestionsForUncovered(
      uncoveredReqObjects,
      roleBreakdown.title,
      llm,
      allQuestions.length + 1
    );

    allQuestions = [...allQuestions, ...newMissingQuestions];
    uncoveredIds = findUncoveredRequirements(requirements, allQuestions);
  }

  // STEP 17: Run deterministic schedule allocator
  updateProgress("Allocating deterministic schedule", 95);
  const schedule = generateDeterministicSchedule(requirements, allQuestions, days);

  // STEP 18: Construct and validate Appendix A kit
  updateProgress("Validating Appendix A structure", 98);
  const rawKit: AppendixAKit = {
    source: {
      company: companyBrief.summary ? companyBrief.summary.slice(0, 40) : "Company",
      company_url,
      role: roleBreakdown.title,
      location: jdExtraction.location,
      jd_chars: jd.length,
      researched_at: new Date().toISOString(),
      pages_used: pagesUsed.length > 0 ? pagesUsed : [company_url],
    },
    company_brief: companyBrief,
    role: roleBreakdown,
    questions: allQuestions,
    flashcards,
    schedule,
    coverage: {
      uncovered_requirement_ids: uncoveredIds,
      passes,
    },
  };

  const validation = validateAppendixAKit(rawKit);
  if (!validation.success) {
    // Attempt auto-sanitizing
    const sanitized = sanitizeToExactAppendixA(rawKit);
    const reval = validateAppendixAKit(sanitized);
    if (!reval.success) {
      errors.push(...validation.errors);
      throw new Error(`Appendix A validation failed: ${validation.errors.join("; ")}`);
    }
    updateProgress("Generation completed", 100);
    return {
      kit: sanitized,
      errors,
      warnings,
    };
  }

  updateProgress("Generation completed", 100);
  return {
    kit: rawKit,
    errors,
    warnings,
  };
}
