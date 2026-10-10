import type { Opportunity } from "../types";
import { isWhitelistedEvent } from "@/lib/leagueWhitelist";
import {
  evaluateCornerCompression,
  evaluateGoalVolume,
} from "@/lib/scanner/fixtureScanner";
import { fetchLeagueStandings } from "@/lib/scraper/teamProfiles";
import {
  NormalizedEvent,
  competitionName,
  fetchAllNormalizedEvents,
  fetchEventStatistics,
  isHalftimeWindow,
  isHighTempoLeague,
  scoreLine,
} from "./sofascore";

function badgeFor(event: NormalizedEvent): Opportunity["badge"] {
  if (event.status === "halftime" || isHalftimeWindow(event)) return "Halftime";
  if (event.status === "live") return "Live";
  return "Upcoming";
}

function passesShotGate(shotsTotal: number, shotsOnTarget: number): boolean {
  return shotsTotal >= 8 && shotsOnTarget >= 3;
}

function passesCornerPossession(home: number, away: number): boolean {
  const delta = home - away;
  return home >= 62 && away <= 40 && delta >= 20;
}

/** Engine A — Halftime 0-0 Goal Inevitability (Stage 1 radar cards) */
async function detectHalftimeTriggers(events: NormalizedEvent[]): Promise<Opportunity[]> {
  const candidates = events.filter((e) => {
    if (!isWhitelistedEvent(e) || !isHighTempoLeague(e)) return false;
    if (!isHalftimeWindow(e) && e.status !== "halftime") return false;
    return e.homeScore === 0 && e.awayScore === 0;
  });

  const opportunities: Opportunity[] = [];

  await Promise.all(
    candidates.slice(0, 12).map(async (event) => {
      const stats = await fetchEventStatistics(event);
      const shotsTotal = stats?.shotsTotal ?? 0;
      const shotsOnTarget = stats?.shotsOnTarget ?? 0;

      if (!passesShotGate(shotsTotal, shotsOnTarget)) return;

      opportunities.push({
        id: `ht00-${event.id}`,
        type: "halftime_00",
        badge: "Halftime",
        homeTeam: event.homeTeam,
        awayTeam: event.awayTeam,
        competition: competitionName(event),
        eventId: Number(event.espnEventId) || undefined,
        minute: event.minute,
        score: scoreLine(event),
        shotsTotal,
        shotsOnTarget,
        possessionHome: stats?.possessionHome ?? null,
        possessionAway: stats?.possessionAway ?? null,
        recommendedMarket: "Over 0.5 Match Goals",
        recommendedEntry: "Minute 58 to 62",
        rationale:
          "RADAR ACTIVE — Halftime 0 : 0 with ≥8 shots / ≥3 SoT. Enter Over 0.5 Match Goals only between minute 58 and 62.",
        suggestedOdds: 1.6,
        kickoff: event.kickoff,
        detectedAt: new Date().toISOString(),
      });
    })
  );

  return opportunities;
}

/** Engine B — Goal volume: combined home GPG + away GPG (never league avg alone) */
async function detectGoalVolume(events: NormalizedEvent[]): Promise<Opportunity[]> {
  const pool = events.filter(
    (e) => isWhitelistedEvent(e) && e.status !== "finished"
  );

  const leagues = Array.from(
    new Set(pool.map((e) => e.espnLeague || e.leagueKey).filter(Boolean))
  );
  const standingsMap = new Map<string, Awaited<ReturnType<typeof fetchLeagueStandings>>>();
  await Promise.all(
    leagues.map(async (league) => {
      standingsMap.set(league, await fetchLeagueStandings(league));
    })
  );

  const opportunities: Opportunity[] = [];
  const seen = new Set<string>();

  for (const event of pool) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    const league = event.espnLeague || event.leagueKey;
    const hit = evaluateGoalVolume(event, standingsMap.get(league) || []);
    if (!hit) continue;

    opportunities.push({
      id: `gv-${event.id}`,
      type: "goal_volume",
      badge: badgeFor(event),
      homeTeam: event.homeTeam,
      awayTeam: event.awayTeam,
      competition: competitionName(event),
      eventId: Number(event.espnEventId) || undefined,
      minute: event.minute,
      score: event.status === "scheduled" ? "vs" : scoreLine(event),
      leagueAvgGoals: hit.combinedGpg ?? null,
      recommendedMarket: "Asian Total Over 2.0",
      rationale: hit.tacticalDelta,
      suggestedOdds: 1.4,
      kickoff: event.kickoff,
      detectedAt: new Date().toISOString(),
    });
  }

  return opportunities
    .sort((a, b) => (b.leagueAvgGoals || 0) - (a.leagueAvgGoals || 0))
    .slice(0, 12);
}

/** Engine C — Corners: live boxscore OR pre-match static possession dictionary */
async function detectCornerCompression(events: NormalizedEvent[]): Promise<Opportunity[]> {
  const opportunities: Opportunity[] = [];

  const live = events
    .filter((e) => isWhitelistedEvent(e) && (e.status === "live" || e.status === "halftime"))
    .slice(0, 15);

  await Promise.all(
    live.map(async (event) => {
      const stats = await fetchEventStatistics(event);
      if (!stats || stats.possessionHome == null || stats.possessionAway == null) return;
      if (!passesCornerPossession(stats.possessionHome, stats.possessionAway)) return;

      const delta = stats.possessionHome - stats.possessionAway;
      opportunities.push({
        id: `cc-${event.id}`,
        type: "corner_compression",
        badge: badgeFor(event),
        homeTeam: event.homeTeam,
        awayTeam: event.awayTeam,
        competition: competitionName(event),
        eventId: Number(event.espnEventId) || undefined,
        minute: event.minute,
        score: scoreLine(event),
        possessionHome: stats.possessionHome,
        possessionAway: stats.possessionAway,
        shotsTotal: stats.shotsTotal,
        shotsOnTarget: stats.shotsOnTarget,
        recommendedMarket: "Home Over 5.5 Team Corners",
        rationale: `Low Block Corner Compression: home ${stats.possessionHome}% / away ${stats.possessionAway}% (Δ +${delta.toFixed(
          0
        )}%). Primary Home Over 5.5. Fallback: Match Corners Over 8.5/9.5.`,
        suggestedOdds: 1.7,
        kickoff: event.kickoff,
        detectedAt: new Date().toISOString(),
      });
    })
  );

  // Pre-match: static possession dictionary (never live boxscore)
  const scheduled = events.filter(
    (e) => isWhitelistedEvent(e) && e.status === "scheduled"
  );
  const leagues = Array.from(
    new Set(scheduled.map((e) => e.espnLeague || e.leagueKey).filter(Boolean))
  );
  const standingsMap = new Map<string, Awaited<ReturnType<typeof fetchLeagueStandings>>>();
  await Promise.all(
    leagues.map(async (league) => {
      standingsMap.set(league, await fetchLeagueStandings(league));
    })
  );

  for (const event of scheduled) {
    const league = event.espnLeague || event.leagueKey;
    const hit = evaluateCornerCompression(event, standingsMap.get(league) || []);
    if (!hit) continue;
    opportunities.push({
      id: `cc-pre-${event.id}`,
      type: "corner_compression",
      badge: "Upcoming",
      homeTeam: event.homeTeam,
      awayTeam: event.awayTeam,
      competition: competitionName(event),
      eventId: Number(event.espnEventId) || undefined,
      minute: null,
      score: "vs",
      possessionHome: hit.homePoss ?? null,
      possessionAway: hit.awayPoss ?? null,
      recommendedMarket: "Home Over 5.5 Team Corners",
      rationale: hit.tacticalDelta,
      suggestedOdds: 1.55,
      kickoff: event.kickoff,
      detectedAt: new Date().toISOString(),
    });
  }

  return opportunities;
}

export interface ScanResult {
  opportunities: Opportunity[];
  meta: {
    liveCount: number;
    scheduledCount: number;
    source: string;
    polledAt: string;
    nextPollSeconds: number;
  };
  error?: string;
}

export async function runOpportunityScan(): Promise<ScanResult> {
  const polledAt = new Date().toISOString();

  try {
    const { events, source } = await fetchAllNormalizedEvents();
    const whitelisted = events.filter(isWhitelistedEvent);

    if (!whitelisted.length) {
      return {
        opportunities: [],
        meta: {
          liveCount: 0,
          scheduledCount: 0,
          source,
          polledAt,
          nextPollSeconds: 60,
        },
        error:
          "No whitelisted fixtures (EPL / Bundesliga / 2. Bundesliga / Eredivisie / UCL) right now.",
      };
    }

    const live = whitelisted.filter((e) => e.status === "live" || e.status === "halftime");
    const scheduled = whitelisted.filter((e) => e.status === "scheduled");

    const [ht, gv, cc] = await Promise.all([
      detectHalftimeTriggers(whitelisted),
      detectGoalVolume(whitelisted),
      detectCornerCompression(whitelisted),
    ]);

    const opportunities = [...ht, ...cc, ...gv];
    const dedup = new Map<string, Opportunity>();
    for (const op of opportunities) {
      if (!dedup.has(op.id)) dedup.set(op.id, op);
    }

    return {
      opportunities: Array.from(dedup.values()),
      meta: {
        liveCount: live.length,
        scheduledCount: scheduled.length,
        source,
        polledAt,
        nextPollSeconds: 60,
      },
    };
  } catch (err) {
    return {
      opportunities: [],
      meta: {
        liveCount: 0,
        scheduledCount: 0,
        source: "espn",
        polledAt,
        nextPollSeconds: 60,
      },
      error: err instanceof Error ? err.message : "Scanner failed",
    };
  }
}
