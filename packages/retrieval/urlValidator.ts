import net from "node:net";

export interface UrlValidationOptions {
  allowLocal?: boolean;
}

/**
 * Validates a URL and enforces SSRF safety rules.
 * When allowLocal is true (development/evaluation mode), localhost and 127.0.0.1 are permitted.
 */
export function validateUrlForSsrf(urlString: string, options: UrlValidationOptions = {}): { valid: boolean; error?: string; url?: URL } {
  const allowLocal = options.allowLocal ?? (process.env.NODE_ENV !== "production" || process.env.ALLOW_LOCAL_URLS === "true");

  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return { valid: false, error: `Malformed URL: ${urlString}` };
  }

  // Only allow http and https
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { valid: false, error: `Unsupported protocol: ${parsed.protocol}. Only http and https are allowed.` };
  }

  const hostname = parsed.hostname.toLowerCase();

  if (!hostname) {
    return { valid: false, error: "Empty hostname." };
  }

  // Check for localhost / loopback
  const isLocalHostName = hostname === "localhost" || hostname === "localhost.localdomain" || hostname.endsWith(".localhost");

  if (isLocalHostName) {
    if (allowLocal) {
      return { valid: true, url: parsed };
    }
    return { valid: false, error: "Access to localhost is prohibited in production mode." };
  }

  // Check IP addresses
  const ipType = net.isIP(hostname);
  if (ipType !== 0) {
    if (isPrivateOrReservedIp(hostname)) {
      if (allowLocal && (hostname === "127.0.0.1" || hostname === "::1" || hostname === "0.0.0.0")) {
        return { valid: true, url: parsed };
      }
      return { valid: false, error: `Access to private or reserved IP (${hostname}) is prohibited.` };
    }
  }

  // Cloud metadata hosts
  if (hostname === "metadata.google.internal" || hostname === "169.254.169.254" || hostname.includes("metadata")) {
    return { valid: false, error: "Access to cloud metadata endpoints is prohibited." };
  }

  return { valid: true, url: parsed };
}

export function isPrivateOrReservedIp(ip: string): boolean {
  // IPv4 checks
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(p => parseInt(p, 10));
    const [b0, b1] = parts;

    // 127.0.0.0/8 (Loopback)
    if (b0 === 127) return true;
    // 0.0.0.0/8 (Current network)
    if (b0 === 0) return true;
    // 10.0.0.0/8 (Private RFC1918)
    if (b0 === 10) return true;
    // 172.16.0.0/12 (Private RFC1918)
    if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;
    // 192.168.0.0/16 (Private RFC1918)
    if (b0 === 192 && b1 === 168) return true;
    // 169.254.0.0/16 (Link-local)
    if (b0 === 169 && b1 === 254) return true;
    // 224.0.0.0/4 (Multicast)
    if (b0 >= 224) return true;

    return false;
  }

  // IPv6 checks
  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    if (normalized === "::1" || normalized === "::") return true;
    if (normalized.startsWith("fe80:") || normalized.startsWith("fc00:") || normalized.startsWith("fd00:")) return true;
    return false;
  }

  return false;
}
