/**
 * Pre-match tactical evaluator for the daily digest + scanner.
 * Corner compression uses STATIC possession averages only (never live boxscore).
 * Goal volume uses combined team scoring (home GPG + away GPG), not league avg alone.
 */

import type { NormalizedEvent } from "@/lib/scraper/sofascore";
import {
  StandingRow,
  isLowerTable,
  teamGpg,
} from "@/lib/scraper/teamProfiles";
import {
  isElitePossessionSide,
  lookupPossession,
} from "@/lib/scanner/possessionDictionary";
import { formatKickoffEAT } from "@/lib/executionState";
import type { DigestMatchCard } from "@/lib/notifications/digestTemplate";

export type DigestStrategy = "corner_compression" | "goal_volume";

export interface ScannedOpportunity extends DigestMatchCard {
  edgeScore: number;
  combinedGpg?: number;
  homePoss?: number;
  awayPoss?: number;
}

function kickoffEATLabel(kickoff?: string | null): string {
  return formatKickoffEAT(kickoff) || "Kickoff: TBD EAT";
}

function isBottomSix(row: StandingRow | null | undefined, tableSize: number): boolean {
  if (!row || !row.rank || !tableSize) return false;
  // Bottom six of a 20-team table, or bottom ~30% otherwise
  const cutoff = tableSize >= 18 ? tableSize - 5 : Math.ceil(tableSize * 0.7);
  return row.rank >= cutoff;
}

/**
 * Combined scoring rate = home season GPG + away season GPG (sum, not average).
 * Premier League threshold 2.85; other whitelist leagues 2.80.
 */
export function qualifiesGoalVolume(opts: {
  leagueKey: string;
  homeGpg: number | null;
  awayGpg: number | null;
}): { ok: boolean; combined: number | null; threshold: number } {
  const threshold = opts.leagueKey === "eng.1" ? 2.85 : 2.8;
  if (opts.homeGpg == null || opts.awayGpg == null) {
    return { ok: false, combined: null, threshold };
  }
  const combined =
    Math.round((opts.homeGpg + opts.awayGpg) * 100) / 100;
  return { ok: combined >= threshold, combined, threshold };
}

export function evaluateCornerCompression(
  event: NormalizedEvent,
  standings: StandingRow[]
): ScannedOpportunity | null {
  if (event.status !== "scheduled") return null;

  const league = event.espnLeague || event.leagueKey;
  const homePoss = lookupPossession(event.homeTeam, league);
  const awayPoss = lookupPossession(event.awayTeam, league);

  if (homePoss == null || !isElitePossessionSide(homePoss)) return null;

  const awayRow =
    standings.find((s) => s.teamId === event.awayTeamId) ||
    standings.find((s) => s.name === event.awayTeam);

  const awayLowPoss = awayPoss != null && awayPoss <= 40;
  const awayBottomSix = isBottomSix(awayRow, standings.length);
  const awayLowerHalf = isLowerTable(awayRow, standings.length);

  // Elite home (>=62%) vs low-possession (<=40%) OR bottom-six / deep-block underdog
  if (!(awayLowPoss || awayBottomSix || (awayPoss != null && awayPoss <= 42 && awayLowerHalf))) {
    return null;
  }

  const awayDisplay = awayPoss ?? (awayBottomSix ? 38 : 40);
  const delta = Math.round(homePoss - awayDisplay);

  if (delta < 20 && !awayBottomSix) return null;

  return {
    competition: event.competition,
    kickoffEAT: kickoffEATLabel(event.kickoff),
    homeTeam: event.homeTeam,
    awayTeam: event.awayTeam,
    strategy: "corner_compression",
    strategyLabel: "[Corner Compression Reticle]",
    tacticalDelta: `Home Possession ${homePoss}% vs ${awayDisplay}% (+${delta}% delta)${
      awayBottomSix ? " · Away bottom-six / deep block" : ""
    }${awayLowPoss ? " · Opponent historical possession ≤ 40%" : ""}`,
    primaryLine: "Home Team Over 5.5 Corners",
    fallbackLine: "Match Total Corners Over 8.5 / 9.5",
    expectedVolume: "Projected range: 10 - 13 total corners",
    oddsRange: "1.48 - 1.60",
    edgeScore: delta + (awayBottomSix ? 5 : 0) + (homePoss >= 64 ? 3 : 0),
    homePoss,
    awayPoss: awayDisplay,
  };
}

export function evaluateGoalVolume(
  event: NormalizedEvent,
  standings: StandingRow[]
): ScannedOpportunity | null {
  if (event.status !== "scheduled") return null;

  const league = event.espnLeague || event.leagueKey;
  const homeRow =
    standings.find((s) => s.teamId === event.homeTeamId) ||
    standings.find((s) => s.name === event.homeTeam);
  const awayRow =
    standings.find((s) => s.teamId === event.awayTeamId) ||
    standings.find((s) => s.name === event.awayTeam);

  const homeGpg = teamGpg(homeRow);
  const awayGpg = teamGpg(awayRow);
  const gate = qualifiesGoalVolume({
    leagueKey: league,
    homeGpg,
    awayGpg,
  });

  // HARD reject when combined team scoring is below threshold — never fall back to league avg
  if (!gate.ok || gate.combined == null) return null;

  return {
    competition: event.competition,
    kickoffEAT: kickoffEATLabel(event.kickoff),
    homeTeam: event.homeTeam,
    awayTeam: event.awayTeam,
    strategy: "goal_volume",
    strategyLabel: "[Goal Volume Radar]",
    tacticalDelta: `Combined team scoring ${gate.combined.toFixed(
      2
    )} GPG (home ${homeGpg!.toFixed(2)} + away ${awayGpg!.toFixed(
      2
    )} · threshold ${gate.threshold.toFixed(2)})`,
    primaryLine: "Asian Over 2.0 Goals",
    fallbackLine: "Full Match Over 1.5 Goals",
    expectedVolume: "Push cushion on exactly 2 goals via Asian Over 2.0",
    oddsRange: "1.35 - 1.55",
    edgeScore: gate.combined * 10,
    combinedGpg: gate.combined,
  };
}

export function scanFixture(
  event: NormalizedEvent,
  standings: StandingRow[]
): ScannedOpportunity[] {
  const out: ScannedOpportunity[] = [];
  const corner = evaluateCornerCompression(event, standings);
  const goals = evaluateGoalVolume(event, standings);
  if (corner) out.push(corner);
  if (goals) out.push(goals);
  return out;
}

/**
 * Cap digest to top 3–5 highest-edge opportunities, preferring a mix of both strategies.
 */
export function selectTopDigestOpportunities(
  opportunities: ScannedOpportunity[],
  maxTotal = 5
): ScannedOpportunity[] {
  const corners = opportunities
    .filter((o) => o.strategy === "corner_compression")
    .sort((a, b) => b.edgeScore - a.edgeScore);
  const goals = opportunities
    .filter((o) => o.strategy === "goal_volume")
    .sort((a, b) => b.edgeScore - a.edgeScore);

  const selected: ScannedOpportunity[] = [];
  // Prefer up to 3 corners and up to 3 goals, hard cap 5
  const cornerSlots = Math.min(3, corners.length);
  const goalSlots = Math.min(3, goals.length);

  selected.push(...corners.slice(0, cornerSlots));
  selected.push(...goals.slice(0, goalSlots));

  if (selected.length > maxTotal) {
    return selected
      .sort((a, b) => b.edgeScore - a.edgeScore)
      .slice(0, maxTotal)
      .sort((a, b) => {
        // Keep section order: corners first, then goals
        if (a.strategy !== b.strategy) {
          return a.strategy === "corner_compression" ? -1 : 1;
        }
        return b.edgeScore - a.edgeScore;
      });
  }

  // Ensure we always return corners then goals for email sections
  return [
    ...selected.filter((s) => s.strategy === "corner_compression"),
    ...selected.filter((s) => s.strategy === "goal_volume"),
  ];
}
