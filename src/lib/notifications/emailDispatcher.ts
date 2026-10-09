import { ensureSettings, prisma } from "@/lib/prisma";
import { isWhitelistedEvent } from "@/lib/leagueWhitelist";
import {
  NormalizedEvent,
  fetchAllNormalizedEvents,
  fetchEventStatistics,
  isHighTempoLeague,
  leagueGoalAverage,
  scoreLine,
} from "@/lib/scraper/sofascore";
import { formatKickoffEAT } from "@/lib/executionState";
import { maskEmail } from "@/lib/format";
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

const LIVE_EXECUTION_STAGES: AlertStage[] = ["ht_execute_58", "corner_live_25"];
const MAX_LIVE_EXECUTION_ALERTS_PER_DAY = 2;

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

function passesShotGate(shotsTotal: number, shotsOnTarget: number): boolean {
  return shotsTotal >= 8 && shotsOnTarget >= 3;
}

function passesCornerPossession(home: number, away: number): boolean {
  return home >= 62 && away <= 40 && home - away >= 20;
}

function calendarDayBounds(d = new Date()) {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

async function alreadySent(eventKey: string, stage: AlertStage): Promise<boolean> {
  const existing = await prisma.notificationLog.findUnique({
    where: { eventKey_stage: { eventKey, stage } },
  });
  return Boolean(existing);
}

async function liveExecutionCountToday(): Promise<number> {
  const { start, end } = calendarDayBounds();
  return prisma.notificationLog.count({
    where: {
      stage: { in: LIVE_EXECUTION_STAGES },
      sentAt: { gte: start, lte: end },
    },
  });
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
): Promise<{ sent: boolean; stage: AlertStage; subject?: string; error?: string; skippedReason?: string }> {
  if (await alreadySent(eventKey, stage)) {
    return { sent: false, stage, skippedReason: "duplicate" };
  }

  if (LIVE_EXECUTION_STAGES.includes(stage)) {
    const count = await liveExecutionCountToday();
    if (count >= MAX_LIVE_EXECUTION_ALERTS_PER_DAY) {
      return {
        sent: false,
        stage,
        skippedReason: "daily_live_execution_cap",
      };
    }
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

/** Engine B — Pre-match goal volume (25–30 min before KO, GPG ≥ 3.0) */
async function evaluateGoalVolume(
  events: NormalizedEvent[],
  to: string
) {
  const results = [];
  const upcoming = events.filter(
    (e) => e.status === "scheduled" && isWhitelistedEvent(e)
  );

  for (const event of upcoming) {
    const mins = minutesUntilKickoff(event);
    if (!inWindow(mins, 25, 30)) continue;

    const gpg = await leagueGoalAverage(event.leagueKey, events);
    if (gpg < 3.0) continue;

    const kickoffLabel = formatKickoffEAT(event.kickoff);
    results.push(
      await dispatchOne(to, event.id, "goal_volume_prematch", {
        opportunityType: "Pre-Match Goal Volume (Strategy D)",
        homeTeam: event.homeTeam,
        awayTeam: event.awayTeam,
        status: "UPCOMING",
        competition: event.competition,
        pill: "ON WATCHLIST (PRE-MATCH)",
        primaryMarket: "Asian Total Over 2.0",
        oddsRange: "1.35 – 1.45",
        bookmakerFallback:
          "If Asian Over 2.0 is unavailable: use Full Match Over 1.5 inside a two-leg slip, or Full Match Over 2.5 standalone only if odds are ≥ 1.50.",
        executionWindow: kickoffLabel
          ? `Place before ${kickoffLabel.replace("Kickoff: ", "")} kickoff`
          : "Place 25–30 minutes before kickoff",
        rationale: [
          `Statistical hit rate: whitelisted high-transition league averaging ${gpg.toFixed(2)} GPG (≥ 3.0) historically clears Asian Over 2.0 / Over 1.5 at elevated rates.`,
          "Tactical dynamic: high transition leagues create early chance volume versus low-block competitions.",
          "Mathematical safety: Asian Over 2.0 pushes (refunds stake) on exactly 2 goals — whole-line protection versus a hard Over 2.5.",
        ],
        journalUrl: journalUrl({
          match: matchLabel(event),
          market: "Asian Total Over 2.0",
          odds: 1.4,
          strategy: "Strategy D (High Tempo Goal Engine)",
        }),
        kickoffLabel,
      })
    );
  }
  return results;
}

/** Engine A — HT 0-0 radar + minute 58–62 execution (Over 0.5 Match Goals ONLY) */
async function evaluateHalftime(
  events: NormalizedEvent[],
  to: string
) {
  const results = [];
  const liveish = events.filter(
    (e) =>
      isWhitelistedEvent(e) &&
      isHighTempoLeague(e) &&
      (e.status === "live" || e.status === "halftime") &&
      e.homeScore === 0 &&
      e.awayScore === 0
  );

  for (const event of liveish) {
    const minute = event.minute;
    const stats = await fetchEventStatistics(event);
    const shotsTotal = stats?.shotsTotal ?? 0;
    const shotsOnTarget = stats?.shotsOnTarget ?? 0;

    // Stage 1 — Radar at HT / minute 45–48
    const atRadar = event.status === "halftime" || inWindow(minute, 45, 48);
    if (atRadar) {
      // CRITICAL: SoT ≤ 2 aborts immediately
      if (!passesShotGate(shotsTotal, shotsOnTarget)) {
        continue;
      }

      results.push(
        await dispatchOne(to, event.id, "ht_radar_46", {
          opportunityType: "Halftime 0-0 Radar Alert",
          homeTeam: event.homeTeam,
          awayTeam: event.awayTeam,
          status: "HALFTIME",
          competition: event.competition,
          pill: "ON WATCHLIST (PRE-MATCH)",
          primaryMarket: "Over 0.5 Match Goals",
          oddsRange: "1.55 – 1.70",
          bookmakerFallback:
            "If Over 0.5 Match Goals is temporarily suspended, wait 60 seconds on SportyBet for the line to reopen. Do not switch to Over 1.5 or Over 2.5.",
          executionWindow: "Arm entry for Minute 58 to 62 only — do not chase earlier",
          rationale: [
            "Statistical hit rate: 0-0 HT with ≥8 shots / ≥3 SoT in whitelisted leagues has historically converted to a second-half goal ~87.1% of the time.",
            "Tactical dynamic: fatigue after minute 70 and extended stoppage time open the game after a locked first half.",
            "Mathematical safety: Over 0.5 Match Goals is the only valid live selection — multi-goal lines need too many strikes in under 30 minutes.",
          ],
          journalUrl: journalUrl({
            match: matchLabel(event),
            market: "Over 0.5 Match Goals",
            odds: 1.6,
            strategy: "Custom Live Trigger (Halftime 0 : 0)",
          }),
          score: scoreLine(event),
          minute: minute ?? 45,
        })
      );
    }

    // Stage 2 — Execution at minute 58–62 (poll window 57–62)
    if (
      inWindow(minute, 57, 62) &&
      event.homeScore === 0 &&
      event.awayScore === 0
    ) {
      // Re-validate shot gate; abort if SoT was never qualifying
      if (!passesShotGate(shotsTotal, shotsOnTarget)) {
        continue;
      }

      results.push(
        await dispatchOne(to, event.id, "ht_execute_58", {
          opportunityType: "Halftime 0-0 Execution Alert",
          homeTeam: event.homeTeam,
          awayTeam: event.awayTeam,
          status: "LIVE",
          competition: event.competition,
          pill: "ACTION REQUIRED NOW",
          primaryMarket: "Over 0.5 Match Goals",
          oddsRange: "1.55 – 1.70",
          bookmakerFallback:
            "If Over 0.5 Match Goals is temporarily suspended, wait 60 seconds on SportyBet for the line to reopen. Never use Over 1.5 or Over 2.5 for this live trigger.",
          executionWindow: "Enter immediately between Minute 58 and Minute 62",
          rationale: [
            "Statistical hit rate: verified 0-0 HT radar setups in whitelist leagues clear a remaining goal ~87.1% historically.",
            "Tactical dynamic: second-half tempo rises; fatigue after minute 70 and stoppage time expand chance volume.",
            "Mathematical safety: Over 0.5 Match Goals only — Over 1.5 / Over 2.5 require multiple goals in under 30 minutes and are banned for this trigger.",
          ],
          journalUrl: journalUrl({
            match: matchLabel(event),
            market: "Over 0.5 Match Goals",
            odds: 1.6,
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

/** Engine C — Corner compression */
async function evaluateCorners(
  events: NormalizedEvent[],
  to: string
) {
  const results = [];

  const live = events.filter(
    (e) =>
      isWhitelistedEvent(e) &&
      e.status === "live" &&
      inWindow(e.minute, 23, 27)
  );

  for (const event of live) {
    const stats = await fetchEventStatistics(event);
    if (!stats || stats.possessionHome == null || stats.possessionAway == null) continue;
    if (!passesCornerPossession(stats.possessionHome, stats.possessionAway)) continue;

    results.push(
      await dispatchOne(to, event.id, "corner_live_25", {
        opportunityType: "Low Block Corner Compression",
        homeTeam: event.homeTeam,
        awayTeam: event.awayTeam,
        status: "LIVE",
        competition: event.competition,
        pill: "ACTION REQUIRED NOW",
        primaryMarket: "Home Team Over 5.5 Corners",
        oddsRange: "1.65 – 1.80",
        bookmakerFallback:
          "If Home Over 5.5 is unavailable on SportyBet, select Total Match Corners Over 9.5 or Over 10.5. Expected match range: 10 to 13 total corners.",
        executionWindow: "Enter around Minute 25 while possession dominance holds",
        rationale: [
          `Statistical hit rate: home possession ≥62% with away ≤40% (Δ ≥20pp) historically stacks team corners in whitelist leagues.`,
          "Tactical dynamic: low-block visitors clear under pressure → recycled wide entries and repeated corner cycles.",
          "Mathematical safety: prefer Home Over 5.5; total-corner fallback (9.5/10.5) covers the expected 10–13 corner band.",
        ],
        journalUrl: journalUrl({
          match: matchLabel(event),
          market: "Home Team Over 5.5 Corners",
          odds: 1.7,
          strategy: "Strategy D (High Tempo Goal Engine)",
        }),
        score: scoreLine(event),
        minute: event.minute,
      })
    );
  }

  const upcoming = events.filter(
    (e) => e.status === "scheduled" && isWhitelistedEvent(e)
  );
  for (const event of upcoming) {
    const mins = minutesUntilKickoff(event);
    if (!inWindow(mins, 24, 26)) continue;
    if (!event.espnLeague || !event.espnEventId) continue;

    const stats = await fetchEventStatistics(event);
    if (!stats || stats.possessionHome == null || stats.possessionAway == null) continue;
    if (!passesCornerPossession(stats.possessionHome, stats.possessionAway)) continue;

    const kickoffLabel = formatKickoffEAT(event.kickoff);
    results.push(
      await dispatchOne(to, event.id, "corner_prematch_25", {
        opportunityType: "Low Block Corner Compression",
        homeTeam: event.homeTeam,
        awayTeam: event.awayTeam,
        status: "UPCOMING",
        competition: event.competition,
        pill: "ON WATCHLIST (PRE-MATCH)",
        primaryMarket: "Home Team Over 5.5 Corners",
        oddsRange: "1.65 – 1.80",
        bookmakerFallback:
          "If Home Over 5.5 is unavailable on SportyBet, select Total Match Corners Over 9.5 or Over 10.5. Expected match range: 10 to 13 total corners.",
        executionWindow: kickoffLabel
          ? `Place before ${kickoffLabel.replace("Kickoff: ", "")} kickoff`
          : "Place ~25 minutes before kickoff",
        rationale: [
          "Statistical hit rate: projected home possession ≥62% / away ≤40% elevates team-corner conversion in whitelist leagues.",
          "Tactical dynamic: expected low-block visitor shape funnels attacks wide into corner recycles.",
          "Mathematical safety: prefer Home Over 5.5; fall back to match totals Over 9.5/10.5 (expected 10–13 corners).",
        ],
        journalUrl: journalUrl({
          match: matchLabel(event),
          market: "Home Team Over 5.5 Corners",
          odds: 1.7,
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
  details: Array<{
    sent: boolean;
    stage: AlertStage;
    subject?: string;
    error?: string;
    skippedReason?: string;
  }>;
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
  const whitelisted = events.filter(isWhitelistedEvent);

  const details = [
    ...(await evaluateGoalVolume(whitelisted, to)),
    ...(await evaluateHalftime(whitelisted, to)),
    ...(await evaluateCorners(whitelisted, to)),
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

export async function sendTestEmail() {
  const settings = await ensureSettings();
  const cfg = getMailConfig();
  // Always use server-stored recipient — never trust a client-supplied address for tests
  const recipient = settings.alertEmail || cfg.defaultTo;
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
      "Tactical dynamic: confirms STARTTLS on port 587 from the AlphaFooty VPS.",
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

  return { ok: true, toMasked: maskEmail(recipient) };
}
