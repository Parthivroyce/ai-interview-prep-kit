export interface RobotsRule {
  disallowedPaths: string[];
}

/**
 * Basic robots.txt parser and checker
 */
export class RobotsChecker {
  private disallowedPaths: string[] = [];
  private fetched: boolean = false;

  constructor(private readonly baseUrl: string) {}

  public async init(timeoutMs: number = 4000): Promise<void> {
    if (this.fetched) return;
    this.fetched = true;

    try {
      const robotsUrl = new URL("/robots.txt", this.baseUrl).toString();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(robotsUrl, {
        signal: controller.signal,
        headers: { "User-Agent": "AIInterviewPrepKit/1.0 (+https://example.com/bot)" },
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        return; // No robots.txt or error => allow
      }

      const text = await res.text();
      this.parseRobotsTxt(text);
    } catch {
      // Robots fetch failed or timed out => proceed gently
    }
  }

  private parseRobotsTxt(content: string): void {
    const lines = content.split(/\r?\n/);
    let appliesToUs = false;

    for (const line of lines) {
      const cleaned = line.trim();
      if (cleaned.startsWith("#") || !cleaned) continue;

      const [field, ...valParts] = cleaned.split(":");
      if (!field || valParts.length === 0) continue;

      const key = field.trim().toLowerCase();
      const val = valParts.join(":").trim();

      if (key === "user-agent") {
        appliesToUs = val === "*" || val.toLowerCase().includes("aiinterview");
      } else if (appliesToUs && key === "disallow") {
        if (val) {
          this.disallowedPaths.push(val);
        }
      }
    }
  }

  public isAllowed(targetUrl: string): boolean {
    try {
      const parsed = new URL(targetUrl);
      const path = parsed.pathname;

      for (const disallowed of this.disallowedPaths) {
        if (disallowed === "/") return false;
        if (path.startsWith(disallowed)) {
          return false;
        }
      }
      return true;
    } catch {
      return true;
    }
  }
}
