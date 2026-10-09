export function formatTZS(value: number): string {
  return new Intl.NumberFormat("en-TZ", {
    style: "currency",
    currency: "TZS",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

/** Mask PII for API/UI — e.g. nathaniel@gmail.com → n••••••@g••••.com */
export function maskEmail(email: string): string {
  const value = (email || "").trim();
  const at = value.indexOf("@");
  if (at < 1) return "configured";
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  const dot = domain.lastIndexOf(".");
  const domainName = dot > 0 ? domain.slice(0, dot) : domain;
  const tld = dot > 0 ? domain.slice(dot) : "";
  const maskLocal = local[0] + "•".repeat(Math.max(3, local.length - 1));
  const maskDomain =
    (domainName[0] || "•") + "•".repeat(Math.max(3, domainName.length - 1)) + tld;
  return `${maskLocal}@${maskDomain}`;
}

export function formatPct(value: number): string {
  return `${(value || 0).toFixed(1)}%`;
}

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
