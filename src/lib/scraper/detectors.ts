import type { Opportunity } from "../types";
import {
  NormalizedEvent,
  competitionName,
  fetchAllNormalizedEvents,
  fetchEventStatistics,
  isHalftimeWindow,
  isHighTempoLeague,
  leagueGoalAverage,
  scoreLine,
} from "./sofascore";

function badgeFor(event: NormalizedEvent): Opportunity["badge"] {
  if (event.status === "halftime" || isHalftimeWindow(event)) return "Halftime";
  if (event.status === "live") return "Live";
  return "Upcoming";
}

async function detectHalftimeTriggers(events: NormalizedEvent[]): Promise<Opportunity[]> {
  const candidates = events.filter((e) => {
    if (!isHighTempoLeague(e)) return false;
    if (!isHalftimeWindow(e) && e.status !== "halftime") return false;
    return e.homeScore === 0 && e.awayScore === 0;
  });

  const opportunities: Opportunity[] = [];

  await Promise.all(
    candidates.slice(0, 12).map(async (event) => {
      const stats = await fetchEventStatistics(event);
      const shotsTotal = stats?.shotsTotal ?? 0;
      const shotsOnTarget = stats?.shotsOnTarget ?? 0;

      // Strategy D: combined shots >= 8 and SoT >= 3
      if (shotsTotal < 8 || shotsOnTarget < 3) return;

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
        recommendedMarket: "Over 0.5 Goals",
        recommendedEntry: "Minute 58",
        rationale:
          "Halftime 0 : 0 Goal Trigger Active. Recommended entry at minute 58 for Over 0.5 Goals.",
        suggestedOdds: 1.45,
        kickoff: event.kickoff,
        detectedAt: new Date().toISOString(),
      });
    })
  );

  return opportunities;
}

async function detectGoalVolume(events: NormalizedEvent[]): Promise<Opportunity[]> {
  const pool = events.filter(
    (e) => isHighTempoLeague(e) && e.status !== "finished"
  );

  const leagueKeys = Array.from(new Set(pool.map((e) => e.leagueKey)));
  const avgMap = new Map<string, number>();
  await Promise.all(
    leagueKeys.map(async (key) => {
      avgMap.set(key, await leagueGoalAverage(key, events));
    })
  );

  const opportunities: Opportunity[] = [];
  const seen = new Set<string>();

  for (const event of pool) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    const avg = avgMap.get(event.leagueKey);
    if (avg == null || avg <= 3.0) continue;

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
      leagueAvgGoals: avg,
      recommendedMarket: "Over 1.5 / Asian Over 2.0",
      rationale: `League goal average ${avg.toFixed(
        2
      )} GPG (> 3.0). Surfacing Over 1.5 and Asian Over 2.0 lines.`,
      suggestedOdds: 1.55,
      kickoff: event.kickoff,
      detectedAt: new Date().toISOString(),
    });
  }

  return opportunities
    .sort((a, b) => (b.leagueAvgGoals || 0) - (a.leagueAvgGoals || 0))
    .slice(0, 18);
}

async function detectCornerCompression(events: NormalizedEvent[]): Promise<Opportunity[]> {
  const candidates = events
    .filter((e) => isHighTempoLeague(e) && (e.status === "live" || e.status === "halftime"))
    .slice(0, 15);

  const opportunities: Opportunity[] = [];

  await Promise.all(
    candidates.map(async (event) => {
      const stats = await fetchEventStatistics(event);
      if (!stats || stats.possessionHome == null || stats.possessionAway == null) return;

      const delta = stats.possessionHome - stats.possessionAway;
      if (delta < 20) return;

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
        recommendedMarket: "Over 5.5 Team Corners (Home)",
        rationale: `Low Block Corner Compression: home possession delta +${delta.toFixed(
          0
        )}% (${stats.possessionHome}% vs ${stats.possessionAway}%). Flagging Over 5.5 Team Corners.`,
        suggestedOdds: 1.72,
        kickoff: event.kickoff,
        detectedAt: new Date().toISOString(),
      });
    })
  );

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

    if (!events.length) {
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
          "No fixtures returned from public sports endpoints. Will retry on next poll.",
      };
    }

    const live = events.filter((e) => e.status === "live" || e.status === "halftime");
    const scheduled = events.filter((e) => e.status === "scheduled");

    const [ht, gv, cc] = await Promise.all([
      detectHalftimeTriggers(events),
      detectGoalVolume(events),
      detectCornerCompression(live),
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
