export type DigestStrategy = "corner_compression" | "goal_volume";

export interface DigestMatchCard {
  competition: string;
  kickoffEAT: string;
  homeTeam: string;
  awayTeam: string;
  strategy: DigestStrategy;
  strategyLabel: string;
  tacticalDelta: string;
  primaryLine: string;
  fallbackLine: string;
  expectedVolume: string;
  oddsRange: string;
  edgeScore?: number;
}

export function todayDateEAT(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function formatDisplayDateEAT(isoDate: string): string {
  const [y, m, day] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, day, 12));
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(utc);
}

export function buildDigestSubject(count: number, digestDate: string): string {
  return `[AlphaFooty Daily Digest] ${count} High-Probability Matchups for ${formatDisplayDateEAT(digestDate)}`;
}

function renderCard(m: DigestMatchCard): string {
  return `
      <tr>
        <td style="padding:0 24px 12px;">
          <div style="border:1px solid #1f2937;border-radius:6px;padding:14px;">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;">
              ${m.competition} · ${m.kickoffEAT}
            </div>
            <div style="margin-top:6px;font-size:17px;font-weight:700;color:#f8fafc;">
              ${m.homeTeam} vs ${m.awayTeam}
            </div>
            <div style="margin-top:8px;font-size:13px;color:#e2e8f0;">
              Strategy: <strong>${m.strategyLabel}</strong>
            </div>
            <div style="margin-top:6px;font-size:13px;color:#94a3b8;line-height:1.5;">
              ${m.tacticalDelta}
            </div>
            <div style="margin-top:10px;font-size:13px;color:#e2e8f0;line-height:1.55;">
              <div><strong>Primary:</strong> ${m.primaryLine} @ ${m.oddsRange}</div>
              <div style="margin-top:4px;"><strong>Fallback:</strong> ${m.fallbackLine}</div>
              <div style="margin-top:4px;color:#94a3b8;">${m.expectedVolume}</div>
            </div>
          </div>
        </td>
      </tr>`;
}

function sectionHeader(title: string, subtitle: string): string {
  return `
      <tr>
        <td style="padding:18px 24px 8px;">
          <div style="font-size:14px;font-weight:700;color:#f8fafc;">${title}</div>
          <div style="margin-top:2px;font-size:12px;color:#64748b;">${subtitle}</div>
        </td>
      </tr>`;
}

export function buildDigestHtml(opts: {
  digestDate: string;
  matches: DigestMatchCard[];
  trackerUrl: string;
}): string {
  const corners = opts.matches.filter((m) => m.strategy === "corner_compression");
  const goals = opts.matches.filter((m) => m.strategy === "goal_volume");

  const cornerBlock = corners.length
    ? sectionHeader(
        "Section A · Corner Compression Watchlist",
        "Primary: Home Team Over 5.5 Corners · Fallback: Match Over 8.5 / 9.5"
      ) + corners.map(renderCard).join("")
    : "";

  const goalBlock = goals.length
    ? sectionHeader(
        "Section B · Goal Volume Watchlist",
        "Primary: Asian Over 2.0 Goals · Fallback: Over 1.5"
      ) + goals.map(renderCard).join("")
    : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#0b1220;font-family:Arial,Helvetica,sans-serif;color:#e2e8f0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0b1220;padding:24px 12px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#111827;border:1px solid #1f2937;border-radius:8px;">
        <tr>
          <td style="padding:20px 24px;border-bottom:1px solid #1f2937;">
            <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">AlphaFooty Engine</div>
            <div style="margin-top:8px;font-size:20px;font-weight:700;color:#f8fafc;">Daily Matchday Digest</div>
            <div style="margin-top:4px;font-size:13px;color:#64748b;">
              ${formatDisplayDateEAT(opts.digestDate)} · ${opts.matches.length} top-edge matchup${opts.matches.length === 1 ? "" : "s"} (capped)
            </div>
          </td>
        </tr>
        ${cornerBlock}
        ${goalBlock}
        <tr>
          <td style="padding:8px 24px 24px;" align="center">
            <a href="${opts.trackerUrl}" style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 18px;border-radius:6px;">
              Open AlphaFooty Tracker
            </a>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function buildDigestText(opts: {
  digestDate: string;
  matches: DigestMatchCard[];
  trackerUrl: string;
}): string {
  const corners = opts.matches.filter((m) => m.strategy === "corner_compression");
  const goals = opts.matches.filter((m) => m.strategy === "goal_volume");
  const lines = [
    `AlphaFooty Daily Digest — ${formatDisplayDateEAT(opts.digestDate)}`,
    `${opts.matches.length} top-edge matchups (capped)`,
    "",
  ];

  if (corners.length) {
    lines.push("=== Section A: Corner Compression Watchlist ===");
    lines.push("Primary: Home Team Over 5.5 Corners | Fallback: Match Over 8.5 / 9.5");
    lines.push("");
    for (const m of corners) {
      lines.push(
        `${m.competition} · ${m.kickoffEAT}`,
        `${m.homeTeam} vs ${m.awayTeam}`,
        m.tacticalDelta,
        `Primary: ${m.primaryLine} @ ${m.oddsRange}`,
        `Fallback: ${m.fallbackLine}`,
        m.expectedVolume,
        ""
      );
    }
  }

  if (goals.length) {
    lines.push("=== Section B: Goal Volume Watchlist ===");
    lines.push("Primary: Asian Over 2.0 Goals");
    lines.push("");
    for (const m of goals) {
      lines.push(
        `${m.competition} · ${m.kickoffEAT}`,
        `${m.homeTeam} vs ${m.awayTeam}`,
        m.tacticalDelta,
        `Primary: ${m.primaryLine} @ ${m.oddsRange}`,
        `Fallback: ${m.fallbackLine}`,
        m.expectedVolume,
        ""
      );
    }
  }

  lines.push(`Open tracker: ${opts.trackerUrl}`);
  return lines.join("\n");
}
