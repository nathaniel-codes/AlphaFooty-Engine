/**
 * Pre-match team profiles from ESPN standings, odds, and recent possession samples.
 */

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
};

type CacheEntry<T> = { expires: number; data: T };
const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) {
    cache.delete(key);
    return null;
  }
  return hit.data as T;
}

function setCache<T>(key: string, data: T, ttlMs: number) {
  cache.set(key, { data, expires: Date.now() + ttlMs });
}

async function fetchJson<T>(url: string, ttlMs = 300_000): Promise<T | null> {
  const cached = getCached<T>(url);
  if (cached) return cached;
  try {
    const res = await fetch(url, { headers: BROWSER_HEADERS, cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as T;
    setCache(url, data, ttlMs);
    return data;
  } catch {
    return null;
  }
}

export interface StandingRow {
  teamId: string;
  name: string;
  rank: number;
  gamesPlayed: number;
  pointsFor: number;
  pointsAgainst: number;
  wins: number;
  losses: number;
  ties: number;
}

export async function fetchLeagueStandings(league: string): Promise<StandingRow[]> {
  const data = await fetchJson<{
    children?: Array<{
      standings?: {
        entries?: Array<{
          team?: { id?: string; displayName?: string };
          stats?: Array<{ name?: string; value?: number; displayValue?: string }>;
        }>;
      };
    }>;
  }>(`https://site.api.espn.com/apis/v2/sports/soccer/${league}/standings`, 600_000);

  const entries = data?.children?.[0]?.standings?.entries || [];
  return entries
    .map((e) => {
      const stat = (name: string) => {
        const s = e.stats?.find((x) => x.name === name);
        return Number(s?.value ?? s?.displayValue) || 0;
      };
      return {
        teamId: String(e.team?.id || ""),
        name: e.team?.displayName || "Team",
        rank: stat("rank"),
        gamesPlayed: stat("gamesPlayed"),
        pointsFor: stat("pointsFor"),
        pointsAgainst: stat("pointsAgainst"),
        wins: stat("wins"),
        losses: stat("losses"),
        ties: stat("ties"),
      };
    })
    .filter((r) => r.teamId);
}

export interface MatchOddsContext {
  homeFavorite: boolean;
  awayUnderdog: boolean;
  homeMoneyLine: number | null;
  awayMoneyLine: number | null;
  overUnder: number | null;
}

export async function fetchMatchOdds(
  league: string,
  eventId: string
): Promise<MatchOddsContext | null> {
  const data = await fetchJson<{
    odds?: Array<{
      overUnder?: number;
      homeTeamOdds?: { favorite?: boolean; underdog?: boolean; moneyLine?: number };
      awayTeamOdds?: { favorite?: boolean; underdog?: boolean; moneyLine?: number };
    }>;
  }>(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/summary?event=${eventId}`,
    180_000
  );

  const odds = data?.odds?.[0];
  if (!odds) return null;
  return {
    homeFavorite: Boolean(odds.homeTeamOdds?.favorite),
    awayUnderdog: Boolean(odds.awayTeamOdds?.underdog),
    homeMoneyLine: odds.homeTeamOdds?.moneyLine ?? null,
    awayMoneyLine: odds.awayTeamOdds?.moneyLine ?? null,
    overUnder: odds.overUnder ?? null,
  };
}

async function possessionForTeamInEvent(
  league: string,
  eventId: string,
  teamId: string
): Promise<number | null> {
  const data = await fetchJson<{
    boxscore?: {
      teams?: Array<{
        team?: { id?: string };
        homeAway?: string;
        statistics?: Array<{ name?: string; displayValue?: string }>;
      }>;
    };
  }>(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/summary?event=${eventId}`,
    300_000
  );

  const teams = data?.boxscore?.teams || [];
  const row =
    teams.find((t) => String(t.team?.id) === String(teamId)) ||
    null;
  if (!row) return null;
  const poss = row.statistics?.find((s) => s.name === "possessionPct");
  if (!poss) return null;
  const n = Number(String(poss.displayValue).replace("%", ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Average possession from a team's last few ESPN summary samples. */
export async function fetchTeamPossessionAverage(
  league: string,
  teamId: string,
  recentEventIds: string[]
): Promise<number | null> {
  const samples: number[] = [];
  for (const eventId of recentEventIds.slice(0, 4)) {
    const p = await possessionForTeamInEvent(league, eventId, teamId);
    if (p != null) samples.push(p);
  }
  if (!samples.length) return null;
  return Math.round((samples.reduce((a, b) => a + b, 0) / samples.length) * 10) / 10;
}

export async function fetchRecentEventIdsForTeams(
  league: string,
  eventId: string
): Promise<{ home: string[]; away: string[]; homeTeamId?: string; awayTeamId?: string }> {
  const data = await fetchJson<{
    header?: {
      competitions?: Array<{
        competitors?: Array<{ homeAway?: string; id?: string; team?: { id?: string } }>;
      }>;
    };
    lastFiveGames?: Array<{
      team?: { id?: string };
      events?: Array<{ id?: string }>;
    }>;
  }>(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/summary?event=${eventId}`,
    180_000
  );

  const comps = data?.header?.competitions?.[0]?.competitors || [];
  const homeId =
    comps.find((c) => c.homeAway === "home")?.team?.id ||
    comps.find((c) => c.homeAway === "home")?.id;
  const awayId =
    comps.find((c) => c.homeAway === "away")?.team?.id ||
    comps.find((c) => c.homeAway === "away")?.id;

  const homeEvents: string[] = [];
  const awayEvents: string[] = [];
  for (const block of data?.lastFiveGames || []) {
    const ids = (block.events || [])
      .map((e) => e.id)
      .filter((id): id is string => Boolean(id));
    if (String(block.team?.id) === String(homeId)) homeEvents.push(...ids);
    if (String(block.team?.id) === String(awayId)) awayEvents.push(...ids);
  }

  return {
    home: homeEvents,
    away: awayEvents,
    homeTeamId: homeId ? String(homeId) : undefined,
    awayTeamId: awayId ? String(awayId) : undefined,
  };
}

export function teamGpg(row?: StandingRow | null): number | null {
  if (!row || !row.gamesPlayed) return null;
  return Math.round((row.pointsFor / row.gamesPlayed) * 100) / 100;
}

export function isLowerTable(row: StandingRow | null | undefined, tableSize: number): boolean {
  if (!row || !row.rank || !tableSize) return false;
  return row.rank >= Math.ceil(tableSize * 0.6);
}
