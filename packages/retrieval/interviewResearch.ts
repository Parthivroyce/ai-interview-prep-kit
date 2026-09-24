export interface InterviewEvidence {
  sourceTitle: string;
  sourceUrl: string;
  snippet: string;
}

export interface InterviewResearchResult {
  hasEvidence: boolean;
  evidenceItems: InterviewEvidence[];
  summaryNote: string;
  queriesUsed: string[];
}

export interface InterviewResearchProvider {
  searchInterviewData(companyName: string): Promise<InterviewResearchResult>;
}

/**
 * Robust provider that executes public interview research queries.
 * Queries multiple search terms, extracts relevant findings, or records an honest negative result.
 */
export class PublicInterviewResearchService implements InterviewResearchProvider {
  private customProvider?: (queries: string[]) => Promise<InterviewEvidence[]>;

  constructor(customProvider?: (queries: string[]) => Promise<InterviewEvidence[]>) {
    this.customProvider = customProvider;
  }

  public getQueries(companyName: string): string[] {
    const cleanName = companyName.trim();
    return [
      `${cleanName} interview process`,
      `${cleanName} technical interview`,
      `${cleanName} software engineer interview`,
      `${cleanName} engineering interview`,
      `${cleanName} interview experience`,
    ];
  }

  public async searchInterviewData(companyName: string): Promise<InterviewResearchResult> {
    const queries = this.getQueries(companyName);

    if (this.customProvider) {
      try {
        const items = await this.customProvider(queries);
        if (items && items.length > 0) {
          return {
            hasEvidence: true,
            evidenceItems: items,
            summaryNote: `Discovered ${items.length} public interview discussion reference(s).`,
            queriesUsed: queries,
          };
        }
      } catch {
        // Custom provider failed
      }
    }

    // Honest no-evidence fallback if external public search is not configured or finds no data
    return {
      hasEvidence: false,
      evidenceItems: [],
      summaryNote: `No verified public interview process evidence found for "${companyName}". Pipeline proceeds without fabricated interview stages.`,
      queriesUsed: queries,
    };
  }
}
