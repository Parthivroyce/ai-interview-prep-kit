import * as cheerio from "cheerio";
import { validateUrlForSsrf } from "./urlValidator";
import { RobotsChecker } from "./robots";

export interface CrawlerConfig {
  maxPages?: number;
  maxDepth?: number;
  timeoutMs?: number;
  maxPageBytes?: number;
  requestDelayMs?: number;
  allowLocal?: boolean;
}

export interface CrawledPage {
  url: string;
  title: string;
  text: string;
  depth: number;
  score: number;
}

export interface CrawlResult {
  pages: CrawledPage[];
  pagesUsed: string[];
  visitedUrls: string[];
  errors: string[];
}

const RELEVANCE_SIGNALS: Array<{ word: string; weight: number }> = [
  { word: "interview", weight: 25 },
  { word: "hiring", weight: 20 },
  { word: "career", weight: 18 },
  { word: "careers", weight: 18 },
  { word: "jobs", weight: 15 },
  { word: "job", weight: 12 },
  { word: "engineering", weight: 15 },
  { word: "tech", weight: 10 },
  { word: "culture", weight: 14 },
  { word: "about", weight: 12 },
  { word: "handbook", weight: 14 },
  { word: "work", weight: 8 },
  { word: "recruiting", weight: 16 },
  { word: "values", weight: 10 },
  { word: "team", weight: 8 },
];

export class CompanyCrawler {
  private config: Required<CrawlerConfig>;

  constructor(config: CrawlerConfig = {}) {
    this.config = {
      maxPages: config.maxPages ?? 12,
      maxDepth: config.maxDepth ?? 2,
      timeoutMs: config.timeoutMs ?? 8000,
      maxPageBytes: config.maxPageBytes ?? 1024 * 1024, // 1MB
      requestDelayMs: config.requestDelayMs ?? 100,
      allowLocal: config.allowLocal ?? (process.env.NODE_ENV !== "production" || process.env.ALLOW_LOCAL_URLS === "true"),
    };
  }

  public scoreUrlAndAnchor(urlStr: string, anchorText: string = ""): number {
    let score = 0;
    const lowerUrl = urlStr.toLowerCase();
    const lowerAnchor = anchorText.toLowerCase();

    for (const { word, weight } of RELEVANCE_SIGNALS) {
      if (lowerUrl.includes(word)) {
        score += weight;
      }
      if (lowerAnchor.includes(word)) {
        score += weight * 1.2;
      }
    }

    // Penalize long query strings or media/asset links
    if (/\.(pdf|png|jpg|jpeg|gif|webp|svg|zip|tar|gz|mp4|mp3|css|js)$/i.test(lowerUrl)) {
      score -= 100;
    }

    return score;
  }

  private normalizeUrl(urlString: string): string {
    try {
      const u = new URL(urlString);
      u.hash = "";
      // Remove common tracking params
      const searchParams = new URLSearchParams(u.search);
      for (const key of Array.from(searchParams.keys())) {
        if (key.startsWith("utm_") || key === "ref" || key === "source") {
          searchParams.delete(key);
        }
      }
      u.search = searchParams.toString() ? `?${searchParams.toString()}` : "";
      return u.toString();
    } catch {
      return urlString;
    }
  }

  public async crawl(startUrl: string): Promise<CrawlResult> {
    const pages: CrawledPage[] = [];
    const errors: string[] = [];
    const visited = new Set<string>();

    const validation = validateUrlForSsrf(startUrl, { allowLocal: this.config.allowLocal });
    if (!validation.valid || !validation.url) {
      return {
        pages: [],
        pagesUsed: [],
        visitedUrls: [],
        errors: [validation.error || "Invalid start URL."],
      };
    }

    const baseOrigin = validation.url.origin;
    const baseHostname = validation.url.hostname;

    const robots = new RobotsChecker(baseOrigin);
    await robots.init(Math.min(this.config.timeoutMs, 3000));

    // Priority Queue: Array of candidates sorted by score descending
    interface QueueItem {
      url: string;
      depth: number;
      score: number;
    }

    const queue: QueueItem[] = [
      {
        url: this.normalizeUrl(startUrl),
        depth: 0,
        score: 100, // starting page gets high initial priority
      },
    ];

    while (queue.length > 0 && pages.length < this.config.maxPages) {
      // Pick highest score item
      queue.sort((a, b) => b.score - a.score);
      const current = queue.shift()!;

      const normalized = this.normalizeUrl(current.url);
      if (visited.has(normalized)) continue;
      visited.add(normalized);

      if (!robots.isAllowed(normalized)) {
        continue;
      }

      // Respect request delay
      if (pages.length > 0 && this.config.requestDelayMs > 0) {
        await new Promise(r => setTimeout(r, this.config.requestDelayMs));
      }

      try {
        const pageSsrf = validateUrlForSsrf(normalized, { allowLocal: this.config.allowLocal });
        if (!pageSsrf.valid) {
          errors.push(`Skipping unsafe URL ${normalized}: ${pageSsrf.error}`);
          continue;
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);

        const res = await fetch(normalized, {
          signal: controller.signal,
          redirect: "follow",
          headers: {
            "User-Agent": "AIInterviewPrepKit/1.0 (Mozilla/5.0 Compatible Bot)",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
        });
        clearTimeout(timer);

        if (!res.ok) {
          errors.push(`HTTP ${res.status} for ${normalized}`);
          continue;
        }

        // Validate final URL after redirects for SSRF
        const finalUrl = res.url || normalized;
        const redirectSsrf = validateUrlForSsrf(finalUrl, { allowLocal: this.config.allowLocal });
        if (!redirectSsrf.valid) {
          errors.push(`Redirected to disallowed URL: ${finalUrl}`);
          continue;
        }

        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml") && !contentType.includes("text/plain")) {
          continue; // Skip non-HTML documents
        }

        // Read up to maxPageBytes
        const arrayBuf = await res.arrayBuffer();
        if (arrayBuf.byteLength > this.config.maxPageBytes) {
          errors.push(`Page exceeded size limit (${arrayBuf.byteLength} bytes): ${normalized}`);
          continue;
        }

        const html = new TextDecoder("utf-8").decode(arrayBuf);
        const $ = cheerio.load(html);

        // Remove noise tags
        $("script, style, noscript, svg, iframe, canvas, nav, footer, header").remove();

        const pageTitle = $("title").text().trim() || $("h1").first().text().trim() || "";

        // Extract readable clean body text
        const bodyText = $("body")
          .text()
          .replace(/\s+/g, " ")
          .replace(/(\n\s*)+/g, "\n")
          .trim();

        if (bodyText.length > 50) {
          pages.push({
            url: normalized,
            title: pageTitle,
            text: bodyText.slice(0, 10000), // Cap per page to prevent oversized context
            depth: current.depth,
            score: current.score,
          });
        }

        // If depth limit not reached, discover and rank links
        if (current.depth < this.config.maxDepth) {
          $("a[href]").each((_, el) => {
            const href = $(el).attr("href");
            const anchorText = $(el).text().trim();
            if (!href) return;

            try {
              const resolved = new URL(href, normalized);
              // Only crawl same-domain links
              if (resolved.hostname === baseHostname || resolved.hostname.endsWith(`.${baseHostname}`)) {
                const normLink = this.normalizeUrl(resolved.toString());
                if (!visited.has(normLink)) {
                  const linkScore = this.scoreUrlAndAnchor(normLink, anchorText);
                  if (linkScore >= 0) {
                    queue.push({
                      url: normLink,
                      depth: current.depth + 1,
                      score: linkScore,
                    });
                  }
                }
              }
            } catch {
              // Ignore invalid href
            }
          });
        }
      } catch (err: any) {
        errors.push(`Failed to crawl ${normalized}: ${err.message || String(err)}`);
      }
    }

    return {
      pages,
      pagesUsed: pages.map(p => p.url),
      visitedUrls: Array.from(visited),
      errors,
    };
  }
}
