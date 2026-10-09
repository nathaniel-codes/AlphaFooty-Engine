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

/** Minimal dark template — slate + single emerald accent only */
export function buildAlertHtml(p: AlertEmailPayload): string {
  const bullets = p.rationale
    .map(
      (b) =>
        `<li style="margin:0 0 8px;color:#94a3b8;font-size:14px;line-height:1.5;">${b}</li>`
    )
    .join("");

  const metaBits = [
    `Status: ${p.status}`,
    p.score ? `Score: ${p.score}` : null,
    p.minute != null ? `Minute: ${p.minute}'` : null,
    p.kickoffLabel || null,
  ]
    .filter(Boolean)
    .join(" · ");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#0b1220;font-family:Arial,Helvetica,sans-serif;color:#e2e8f0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0b1220;padding:24px 12px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#111827;border:1px solid #1f2937;border-radius:8px;">
        <tr>
          <td style="padding:20px 24px;border-bottom:1px solid #1f2937;">
            <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">AlphaFooty Engine</div>
            <div style="margin-top:8px;font-size:18px;font-weight:700;color:#f8fafc;">${p.opportunityType}</div>
            <div style="margin-top:4px;font-size:13px;color:#64748b;">${p.competition}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 24px;">
            <div style="display:inline-block;padding:6px 10px;border:1px solid #334155;border-radius:4px;font-size:11px;font-weight:700;letter-spacing:0.04em;color:#e2e8f0;background:#0b1220;">
              ${p.pill}
            </div>
            <div style="margin:14px 0 6px;font-size:20px;font-weight:700;color:#f8fafc;">
              ${p.homeTeam} vs ${p.awayTeam}
            </div>
            <div style="font-size:13px;color:#64748b;">${metaBits}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:0 24px 16px;">
            <div style="border:1px solid #1f2937;border-radius:6px;padding:14px;">
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;margin-bottom:6px;">Recommended Bet</div>
              <div style="font-size:16px;font-weight:700;color:#f8fafc;">${p.primaryMarket}</div>
              <div style="margin-top:4px;font-size:13px;color:#94a3b8;">Odds range: ${p.oddsRange}</div>
              <div style="margin-top:10px;font-size:13px;color:#94a3b8;line-height:1.5;">
                <span style="color:#e2e8f0;font-weight:600;">Fallback:</span> ${p.bookmakerFallback}
              </div>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:0 24px 16px;">
            <div style="border:1px solid #1f2937;border-radius:6px;padding:14px;">
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;margin-bottom:6px;">Execution Window</div>
              <div style="font-size:15px;font-weight:600;color:#f8fafc;">${p.executionWindow}</div>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:0 24px 16px;">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;margin-bottom:8px;">Why This Alert</div>
            <ul style="margin:0;padding-left:18px;">${bullets}</ul>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 24px 24px;" align="center">
            <a href="${p.journalUrl}" style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 18px;border-radius:6px;">
              Log This Bet in Journal
            </a>
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
