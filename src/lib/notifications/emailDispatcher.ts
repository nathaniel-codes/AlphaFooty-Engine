import { ensureSettings, prisma } from "@/lib/prisma";
import {
  NormalizedEvent,
  fetchAllNormalizedEvents,
  fetchEventStatistics,
  isHighTempoLeague,
  leagueGoalAverage,
  scoreLine,
} from "@/lib/scraper/sofascore";
import { formatKickoffEAT } from "@/lib/executionState";
import { sendMail, getMailConfig } from "./mailer";
import {
  AlertEmailPayload,
  buildAlertHtml,
  buildAlertSubject,
  buildAlertText,
} from "./emailTemplate";

export type AlertStage =
  | "goal_volume_prematch"
  | "ht_radar_46"
  | "ht_execute_58"
  | "corner_prematch_25"
  | "corner_live_25";

function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://104.219.236.43:3080"
  ).replace(/\/$/, "");
}

function journalUrl(params: {
  match: string;
  market: string;
  odds: number;
  strategy: string;
}): string {
  const q = new URLSearchParams({
    tab: "journal",
    log: "1",
    match: params.match,
    market: params.market,
    odds: String(params.odds),
    strategy: params.strategy,
  });
  return `${appBaseUrl()}/?${q.toString()}`;
}

function minutesUntilKickoff(event: NormalizedEvent): number | null {
  if (!event.kickoff) return null;
  const start = new Date(event.kickoff).getTime();
  if (Number.isNaN(start)) return null;
  return (start - Date.now()) / 60000;
}

function inWindow(value: number | null, min: number, max: number): boolean {
  return value != null && value >= min && value <= max;
}

async function alreadySent(eventKey: string, stage: AlertStage): Promise<boolean> {
  const existing = await prisma.notificationLog.findUnique({
    where: { eventKey_stage: { eventKey, stage } },
  });
  return Boolean(existing);
}

async function markSent(eventKey: string, stage: AlertStage, subject: string) {
  await prisma.notificationLog.create({
    data: { eventKey, stage, subject },
  });
}

async function dispatchOne(
  to: string,
  eventKey: string,
  stage: AlertStage,
  payload: AlertEmailPayload
): Promise<{ sent: boolean; stage: AlertStage; subject?: string; error?: string }> {
  if (await alreadySent(eventKey, stage)) {
    return { sent: false, stage };
  }

  const subject = buildAlertSubject(payload);
  try {
    await sendMail({
      to,
      subject,
      html: buildAlertHtml(payload),
      text: buildAlertText(payload),
    });
    await markSent(eventKey, stage, subject);
    return { sent: true, stage, subject };
  } catch (err) {
    return {
      sent: false,
      stage,
      subject,
      error: err instanceof Error ? err.message : "send failed",
    };
  }
}

function matchLabel(e: NormalizedEvent) {
  return `${e.homeTeam} vs ${e.awayTeam}`;
}

async function evaluateGoalVolume(
  events: NormalizedEvent[],
  to: string
): Promise<Array<{ sent: boolean; stage: AlertStage; subject?: string; error?: string }>> {
  const results = [];
  const upcoming = events.filter(
    (e) => e.status === "scheduled" && isHighTempoLeague(e)
  );

  for (const event of upcoming) {
    const mins = minutesUntilKickoff(event);
    if (!inWindow(mins, 25, 30)) continue;

    const gpg = await leagueGoalAverage(event.leagueKey, events);
    if (gpg < 3.0) continue;

    const eventKey = event.id;
    const kickoffLabel = formatKickoffEAT(event.kickoff);
    results.push(
      await dispatchOne(to, eventKey, "goal_volume_prematch", {
        opportunityType: "Pre-Match Goal Volume (Strategy D)",
        homeTeam: event.homeTeam,
        awayTeam: event.awayTeam,
        status: "UPCOMING",
        competition: event.competition,
        pill: "ON WATCHLIST (PRE-MATCH)",
        primaryMarket: "Asian Over 2.0 Goals",
        oddsRange: "1.35 – 1.45",
        bookmakerFallback:
          "If Asian Over 2.0 is unavailable, select Match Goals Over 1.5 or Over 2.5.",
        executionWindow: kickoffLabel
          ? `Place before ${kickoffLabel.replace("Kickoff: ", "")} kickoff`
          : "Place before kickoff (25–30 minute pre-match window)",
        rationale: [
          `Statistical hit rate: leagues averaging ${gpg.toFixed(2)} GPG historically clear Over 1.5 / Asian 2.0 at an elevated clip (~78–87% in high-tempo samples).`,
          "Tactical dynamic: high-tempo sides create early transition volume; first-half goal expectancy is elevated versus low-block leagues.",
          "Mathematical safety: Asian Over 2.0 offers a push cushion if exactly 2 goals land, protecting stake versus a hard Over 2.5 line.",
        ],
        journalUrl: journalUrl({
          match: matchLabel(event),
          market: "Asian Over 2.0 Goals",
          odds: 1.4,
          strategy: "Strategy D (High Tempo Goal Engine)",
        }),
        kickoffLabel,
      })
    );
  }
  return results;
}

async function evaluateHalftime(
  events: NormalizedEvent[],
  to: string
): Promise<Array<{ sent: boolean; stage: AlertStage; subject?: string; error?: string }>> {
  const results = [];
  const liveish = events.filter(
    (e) =>
      isHighTempoLeague(e) &&
      (e.status === "live" || e.status === "halftime") &&
      e.homeScore === 0 &&
      e.awayScore === 0
  );

  for (const event of liveish) {
    const minute = event.minute;
    const eventKey = event.id;
    const stats = await fetchEventStatistics(event);
    const shotsTotal = stats?.shotsTotal ?? 0;
    const shotsOnTarget = stats?.shotsOnTarget ?? 0;

    // Stage 1 — Radar at HT / minute 45–48 window (poll-friendly around 46)
    const atRadar =
      event.status === "halftime" || inWindow(minute, 45, 48);
    if (atRadar && shotsTotal >= 8 && shotsOnTarget >= 3) {
      results.push(
        await dispatchOne(to, eventKey, "ht_radar_46", {
          opportunityType: "Halftime 0-0 Radar Alert",
          homeTeam: event.homeTeam,
          awayTeam: event.awayTeam,
          status: "HALFTIME",
          competition: event.competition,
          pill: "ON WATCHLIST (PRE-MATCH)",
          primaryMarket: "Over 0.5 Goals (2H / Match)",
          oddsRange: "1.30 – 1.55",
          bookmakerFallback:
            "If Asian Over 2.0 is unavailable, select Match Goals Over 1.5 or Over 2.5.",
          executionWindow: "Arm entry for Minute 58 to 62 (do not chase earlier)",
          rationale: [
            "Statistical hit rate: 0-0 HT with ≥8 shots / ≥3 SoT in high-tempo leagues has historically converted to a second-half goal ~87.1% of the time.",
            "Tactical dynamic: fatigue and open space after the restart increase chance creation; pressure compounds after minute 70.",
            "Mathematical safety: Over 0.5 from minute 58 still prices in remaining time while avoiding first-half dead-ball noise.",
          ],
          journalUrl: journalUrl({
            match: matchLabel(event),
            market: "Over 0.5 Goals",
            odds: 1.45,
            strategy: "Custom Live Trigger (Halftime 0 : 0)",
          }),
          score: scoreLine(event),
          minute: minute ?? 45,
        })
      );
    }

    // Stage 2 — Execution at minute 58 (poll window 57–60)
    if (inWindow(minute, 57, 60) && event.homeScore === 0 && event.awayScore === 0) {
      results.push(
        await dispatchOne(to, eventKey, "ht_execute_58", {
          opportunityType: "Halftime 0-0 Execution Alert",
          homeTeam: event.homeTeam,
          awayTeam: event.awayTeam,
          status: "LIVE",
          competition: event.competition,
          pill: "ACTION REQUIRED NOW",
          primaryMarket: "Over 0.5 Goals",
          oddsRange: "1.35 – 1.50",
          bookmakerFallback:
            "If Asian Over 2.0 is unavailable, select Match Goals Over 1.5 or Over 2.5.",
          executionWindow: "Enter between Minute 58 and 62",
          rationale: [
            "Statistical hit rate: execution band (58–62) after a verified 0-0 HT radar historically clears a late goal at ~87.1% in this scenario set.",
            "Tactical dynamic: second-half tempo spikes as benches push; low blocks break under sustained waves after the hour mark.",
            "Mathematical safety: still early enough in the half for price value, with a short 4-minute discipline window to avoid late-panic entries.",
          ],
          journalUrl: journalUrl({
            match: matchLabel(event),
            market: "Over 0.5 Goals",
            odds: 1.4,
            strategy: "Custom Live Trigger (Halftime 0 : 0)",
          }),
          score: scoreLine(event),
          minute,
        })
      );
    }
  }

  return results;
}

async function evaluateCorners(
  events: NormalizedEvent[],
  to: string
): Promise<Array<{ sent: boolean; stage: AlertStage; subject?: string; error?: string }>> {
  const results = [];

  // Live minute ~25 corner compression
  const live = events.filter(
    (e) => isHighTempoLeague(e) && e.status === "live" && inWindow(e.minute, 23, 27)
  );

  for (const event of live) {
    const stats = await fetchEventStatistics(event);
    if (!stats || stats.possessionHome == null || stats.possessionAway == null) continue;
    const delta = stats.possessionHome - stats.possessionAway;
    if (delta < 20 || stats.possessionHome < 62) continue;

    results.push(
      await dispatchOne(to, event.id, "corner_live_25", {
        opportunityType: "Low Block Corner Compression",
        homeTeam: event.homeTeam,
        awayTeam: event.awayTeam,
        status: "LIVE",
        competition: event.competition,
        pill: "ACTION REQUIRED NOW",
        primaryMarket: "Home Over 5.5 Team Corners",
        oddsRange: "1.60 – 1.75",
        bookmakerFallback:
          "If Home Over 5.5 is unavailable on SportyBet, select Total Match Corners Over 9.5 or 10.5 (Expected range: 10 to 13 corners).",
        executionWindow: "Enter around Minute 25 while possession dominance holds",
        rationale: [
          `Statistical hit rate: home possession ≥62% with ≥+20pp delta historically stacks team corners; target clears in the majority of high-tempo samples (~80%+).`,
          "Tactical dynamic: low-block visitors clear under pressure → recycled wide entries and repeated corner cycles.",
          "Mathematical safety: team-corner line isolates the dominant side; total-corner fallback (9.5/10.5) preserves EV if team markets are missing.",
        ],
        journalUrl: journalUrl({
          match: matchLabel(event),
          market: "Home Over 5.5 Team Corners",
          odds: 1.68,
          strategy: "Strategy D (High Tempo Goal Engine)",
        }),
        score: scoreLine(event),
        minute: event.minute,
      })
    );
  }

  // Pre-match 25 min before — only if we already have a possession signal (rare)
  const upcoming = events.filter(
    (e) => e.status === "scheduled" && isHighTempoLeague(e)
  );
  for (const event of upcoming) {
    const mins = minutesUntilKickoff(event);
    if (!inWindow(mins, 24, 26)) continue;
    if (!event.espnLeague || !event.espnEventId) continue;

    const stats = await fetchEventStatistics(event);
    if (!stats || stats.possessionHome == null || stats.possessionAway == null) continue;
    const delta = stats.possessionHome - stats.possessionAway;
    if (delta < 20 || stats.possessionHome < 62) continue;

    const kickoffLabel = formatKickoffEAT(event.kickoff);
    results.push(
      await dispatchOne(to, event.id, "corner_prematch_25", {
        opportunityType: "Low Block Corner Compression",
        homeTeam: event.homeTeam,
        awayTeam: event.awayTeam,
        status: "UPCOMING",
        competition: event.competition,
        pill: "ON WATCHLIST (PRE-MATCH)",
        primaryMarket: "Home Over 5.5 Team Corners",
        oddsRange: "1.60 – 1.75",
        bookmakerFallback:
          "If Home Over 5.5 is unavailable on SportyBet, select Total Match Corners Over 9.5 or 10.5 (Expected range: 10 to 13 corners).",
        executionWindow: kickoffLabel
          ? `Place before ${kickoffLabel.replace("Kickoff: ", "")} kickoff`
          : "Place ~25 minutes before kickoff",
        rationale: [
          "Statistical hit rate: projected home possession dominance (≥62%, +20pp) historically elevates team-corner conversion in high-tempo leagues.",
          "Tactical dynamic: expected low-block visitor shape funnels attacks wide into corner recycles.",
          "Mathematical safety: prefer team corners; fall back to match totals Over 9.5/10.5 if the primary line is offline.",
        ],
        journalUrl: journalUrl({
          match: matchLabel(event),
          market: "Home Over 5.5 Team Corners",
          odds: 1.68,
          strategy: "Strategy D (High Tempo Goal Engine)",
        }),
        kickoffLabel,
      })
    );
  }

  return results;
}

export interface DispatchResult {
  enabled: boolean;
  to: string;
  source: string;
  evaluatedAt: string;
  sent: number;
  skipped: number;
  errors: string[];
  details: Array<{ sent: boolean; stage: AlertStage; subject?: string; error?: string }>;
}

export async function runEmailDispatch(): Promise<DispatchResult> {
  const settings = await ensureSettings();
  const cfg = getMailConfig();
  const to = settings.alertEmail || cfg.defaultTo;
  const evaluatedAt = new Date().toISOString();

  if (!settings.emailEnabled) {
    return {
      enabled: false,
      to,
      source: "none",
      evaluatedAt,
      sent: 0,
      skipped: 0,
      errors: [],
      details: [],
    };
  }

  const { events, source } = await fetchAllNormalizedEvents();
  const details = [
    ...(await evaluateGoalVolume(events, to)),
    ...(await evaluateHalftime(events, to)),
    ...(await evaluateCorners(events, to)),
  ];

  return {
    enabled: true,
    to,
    source,
    evaluatedAt,
    sent: details.filter((d) => d.sent).length,
    skipped: details.filter((d) => !d.sent && !d.error).length,
    errors: details.filter((d) => d.error).map((d) => `${d.stage}: ${d.error}`),
    details,
  };
}

export async function sendTestEmail(to?: string) {
  const settings = await ensureSettings();
  const cfg = getMailConfig();
  const recipient = to || settings.alertEmail || cfg.defaultTo;
  const payload: AlertEmailPayload = {
    opportunityType: "SMTP Test",
    homeTeam: "AlphaFooty",
    awayTeam: "Mail Server",
    status: "TEST",
    competition: "System Check",
    pill: "ON WATCHLIST (PRE-MATCH)",
    primaryMarket: "Connectivity Check",
    oddsRange: "n/a",
    bookmakerFallback: "This is a test email — no bet action required.",
    executionWindow: "No execution window — SMTP verification only",
    rationale: [
      "Statistical hit rate: n/a (test message).",
      "Tactical dynamic: confirms STARTTLS on port 587 is reachable from the AlphaFooty VPS.",
      "Mathematical safety: n/a (test message).",
    ],
    journalUrl: `${appBaseUrl()}/?tab=settings`,
  };

  await sendMail({
    to: recipient,
    subject: buildAlertSubject(payload),
    html: buildAlertHtml(payload),
    text: buildAlertText(payload),
  });

  return { ok: true, to: recipient };
}
