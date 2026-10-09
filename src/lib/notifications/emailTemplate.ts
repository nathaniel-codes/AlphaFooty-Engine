export type AlertPill = "ACTION REQUIRED NOW" | "ON WATCHLIST (PRE-MATCH)";

export interface AlertEmailPayload {
  opportunityType: string;
  homeTeam: string;
  awayTeam: string;
  status: string;
  competition: string;
  pill: AlertPill;
  primaryMarket: string;
  oddsRange: string;
  bookmakerFallback: string;
  executionWindow: string;
  rationale: [string, string, string];
  journalUrl: string;
  score?: string;
  minute?: number | null;
  kickoffLabel?: string | null;
}

export function buildAlertSubject(p: AlertEmailPayload): string {
  return `[AlphaFooty Alert] ${p.opportunityType} - ${p.homeTeam} vs ${p.awayTeam} (${p.status})`;
}

export function buildAlertHtml(p: AlertEmailPayload): string {
  const pillColor =
    p.pill === "ACTION REQUIRED NOW"
      ? "background:#059669;color:#ecfdf5;"
      : "background:#0ea5e9;color:#e0f2fe;";

  const bullets = p.rationale
    .map(
      (b) =>
        `<li style="margin:0 0 10px;color:#cbd5e1;font-size:14px;line-height:1.5;">${b}</li>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#020617;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#020617;padding:24px 12px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#0f172a;border:1px solid #1e293b;border-radius:14px;overflow:hidden;">
        <tr>
          <td style="padding:20px 24px;background:linear-gradient(135deg,#064e3b,#0f172a);border-bottom:1px solid #14532d;">
            <div style="color:#34d399;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">AlphaFooty Engine</div>
            <div style="color:#f8fafc;font-size:20px;font-weight:700;margin-top:8px;">${p.opportunityType}</div>
            <div style="color:#94a3b8;font-size:13px;margin-top:4px;">${p.competition}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 24px;">
            <div style="display:inline-block;padding:8px 14px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:0.6px;${pillColor}">
              ${p.pill}
            </div>
            <h1 style="margin:16px 0 6px;color:#f1f5f9;font-size:22px;line-height:1.3;">
              ${p.homeTeam} <span style="color:#64748b;">vs</span> ${p.awayTeam}
            </h1>
            <div style="color:#94a3b8;font-size:13px;">
              Status: <strong style="color:#e2e8f0;">${p.status}</strong>
              ${p.score ? ` · Score: <strong style="color:#e2e8f0;">${p.score}</strong>` : ""}
              ${p.minute != null ? ` · Minute: <strong style="color:#e2e8f0;">${p.minute}'</strong>` : ""}
              ${p.kickoffLabel ? ` · ${p.kickoffLabel}` : ""}
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:0 24px 20px;">
            <div style="background:#020617;border:1px solid #1e293b;border-radius:12px;padding:16px;">
              <div style="color:#34d399;font-size:11px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;margin-bottom:8px;">Recommended Bet</div>
              <div style="color:#f8fafc;font-size:16px;font-weight:700;">${p.primaryMarket}</div>
              <div style="color:#94a3b8;font-size:13px;margin-top:4px;">Target odds: ${p.oddsRange}</div>
              <div style="margin-top:12px;padding-top:12px;border-top:1px solid #1e293b;color:#cbd5e1;font-size:13px;line-height:1.55;">
                <strong style="color:#fbbf24;">Bookmaker fallback:</strong> ${p.bookmakerFallback}
              </div>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:0 24px 20px;">
            <div style="background:#052e1c;border:1px solid #065f46;border-radius:12px;padding:16px;">
              <div style="color:#6ee7b7;font-size:11px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;margin-bottom:8px;">Execution Window</div>
              <div style="color:#ecfdf5;font-size:15px;font-weight:600;">${p.executionWindow}</div>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:0 24px 20px;">
            <div style="color:#34d399;font-size:11px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;margin-bottom:10px;">Why This Alert</div>
            <ul style="margin:0;padding-left:18px;">${bullets}</ul>
          </td>
        </tr>
        <tr>
          <td style="padding:0 24px 28px;" align="center">
            <a href="${p.journalUrl}" style="display:inline-block;background:#10b981;color:#022c22;text-decoration:none;font-weight:800;font-size:14px;padding:14px 22px;border-radius:10px;">
              Log This Bet in AlphaFooty Journal
            </a>
            <div style="color:#64748b;font-size:11px;margin-top:12px;">One-click opens the journal with this match pre-filled.</div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function buildAlertText(p: AlertEmailPayload): string {
  return [
    `${p.pill}`,
    `${p.opportunityType}: ${p.homeTeam} vs ${p.awayTeam} (${p.status})`,
    `Market: ${p.primaryMarket} @ ${p.oddsRange}`,
    `Fallback: ${p.bookmakerFallback}`,
    `Execution: ${p.executionWindow}`,
    ...p.rationale.map((r, i) => `${i + 1}. ${r}`),
    `Log bet: ${p.journalUrl}`,
  ].join("\n");
}
