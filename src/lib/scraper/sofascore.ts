/**
 * Live football ingestion from public sports JSON endpoints.
 * Primary: ESPN site API (works without API keys).
 * Secondary: Sofascore public API when reachable (X-Requested-With + browser headers).
 * Tertiary: TheSportsDB free calendar feed.
 *
 * Hard-gated to the strict high-transition whitelist only.
 */

import {
  WHITELIST_ESPN_KEYS,
  WHITELIST_GPG_BASELINES,
  WHITELIST_SOFA_IDS,
  isWhitelistedEvent,
} from "@/lib/leagueWhitelist";

export const HIGH_TEMPO_LEAGUES: Record<string, string> = { ...WHITELIST_ESPN_KEYS };

/** Sofascore uniqueTournament IDs — whitelist only */
export const SOFA_LEAGUE_IDS: Record<number, string> = { ...WHITELIST_SOFA_IDS };

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
};

export interface NormalizedEvent {
  id: string;
  source: "espn" | "sofascore" | "thesportsdb";
  leagueKey: string;
  competition: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: "scheduled" | "live" | "halftime" | "finished";
  minute: number | null;
  kickoff: string | null;
  espnLeague?: string;
  espnEventId?: string;
}

export interface MatchShotStats {
  shotsTotal: number;
  shotsOnTarget: number;
  possessionHome: number | null;
  possessionAway: number | null;
  cornersHome: number | null;
  cornersAway: number | null;
}

type CacheEntry<T> = { expires: number; data: T };
const memoryCache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const hit = memoryCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) {
    memoryCache.delete(key);
    return null;
  }
  return hit.data as T;
}

function setCache<T>(key: string, data: T, ttlMs: number) {
  memoryCache.set(key, { data, expires: Date.now() + ttlMs });
}

async function fetchJson<T>(
  url: string,
  headers: Record<string, string> = BROWSER_HEADERS,
  ttlMs = 55_000
): Promise<T | null> {
  const cached = getCached<T>(url);
  if (cached) return cached;
  try {
    const res = await fetch(url, {
      headers,
      cache: "no-store",
      next: { revalidate: 0 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as T;
    setCache(url, data, ttlMs);
    return data;
  } catch {
    return null;
  }
}

function todayEspnDate(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function mapEspnStatus(typeName?: string, detail?: string): NormalizedEvent["status"] {
  const n = (typeName || "").toUpperCase();
  const d = (detail || "").toLowerCase();
  if (n.includes("FINAL") || n.includes("FULL")) return "finished";
  if (n.includes("HALFTIME") || d.includes("half")) return "halftime";
  if (n.includes("FIRST") || n.includes("SECOND") || n.includes("IN_PROGRESS") || n.includes("STATUS_IN"))
    return "live";
  if (n.includes("SCHEDULED") || n.includes("PRE")) return "scheduled";
  if (n.includes("STATUS_")) {
    if (n.includes("HALFTIME")) return "halftime";
    if (n.includes("FIRST") || n.includes("SECOND")) return "live";
  }
  return "scheduled";
}

function parseMinute(clock?: string, period?: number): number | null {
  if (!clock) return period === 2 ? 46 : null;
  const cleaned = String(clock).replace("'", "").trim();
  const n = Number(cleaned);
  if (Number.isFinite(n)) return n;
  return null;
}

/** Fetch real fixtures from ESPN for all high-tempo leagues. */
export async function fetchEspnEvents(): Promise<NormalizedEvent[]> {
  const date = todayEspnDate();
  const leagues = Object.keys(HIGH_TEMPO_LEAGUES);
  const results = await Promise.all(
    leagues.map(async (league) => {
      const data = await fetchJson<{
        events?: Array<{
          id: string;
          date?: string;
          name?: string;
          competitions?: Array<{
            status?: {
              displayClock?: string;
              period?: number;
              type?: { name?: string; detail?: string; description?: string };
            };
            competitors?: Array<{
              homeAway?: string;
              score?: string;
              team?: { displayName?: string; name?: string };
            }>;
          }>;
        }>;
      }>(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard?dates=${date}`,
        BROWSER_HEADERS,
        45_000
      );

      const events: NormalizedEvent[] = [];
      for (const ev of data?.events || []) {
        const comp = ev.competitions?.[0];
        const statusType = comp?.status?.type?.name || comp?.status?.type?.description;
        const detail = comp?.status?.type?.detail;
        const home = comp?.competitors?.find((c) => c.homeAway === "home");
        const away = comp?.competitors?.find((c) => c.homeAway === "away");
        const status = mapEspnStatus(statusType, detail);
        events.push({
          id: `espn-${league}-${ev.id}`,
          source: "espn",
          leagueKey: league,
          competition: HIGH_TEMPO_LEAGUES[league],
          homeTeam: home?.team?.displayName || home?.team?.name || "Home",
          awayTeam: away?.team?.displayName || away?.team?.name || "Away",
          homeScore: Number(home?.score || 0),
          awayScore: Number(away?.score || 0),
          status,
          minute: parseMinute(comp?.status?.displayClock, comp?.status?.period),
          kickoff: ev.date || null,
          espnLeague: league,
          espnEventId: ev.id,
        });
      }
      return events;
    })
  );

  return results.flat();
}

export async function fetchEspnMatchStats(
  league: string,
  eventId: string
): Promise<MatchShotStats | null> {
  const data = await fetchJson<{
    boxscore?: {
      teams?: Array<{
        homeAway?: string;
        statistics?: Array<{ name?: string; displayValue?: string }>;
      }>;
    };
  }>(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/summary?event=${eventId}`,
    BROWSER_HEADERS,
    40_000
  );

  const teams = data?.boxscore?.teams;
  if (!teams?.length) return null;

  const read = (side: "home" | "away", names: string[]) => {
    const team = teams.find((t) => t.homeAway === side) || teams[side === "home" ? 0 : 1];
    const stats = team?.statistics || [];
    const item = stats.find((s) => names.includes(s.name || ""));
    return item ? Number(String(item.displayValue).replace("%", "")) || 0 : 0;
  };

  const homeShots = read("home", ["totalShots", "shots"]);
  const awayShots = read("away", ["totalShots", "shots"]);
  const homeSot = read("home", ["shotsOnTarget"]);
  const awaySot = read("away", ["shotsOnTarget"]);
  const homePoss = read("home", ["possessionPct"]);
  const awayPoss = read("away", ["possessionPct"]);
  const homeCorners = read("home", ["wonCorners"]);
  const awayCorners = read("away", ["wonCorners"]);

  // Season-level boxscores (pre-match) often lack shot totals — treat as null signal
  const hasLiveStats = homeShots + awayShots + homeSot + awaySot + homePoss + awayPoss > 0;

  if (!hasLiveStats) {
    return {
      shotsTotal: 0,
      shotsOnTarget: 0,
      possessionHome: null,
      possessionAway: null,
      cornersHome: null,
      cornersAway: null,
    };
  }

  return {
    shotsTotal: homeShots + awayShots,
    shotsOnTarget: homeSot + awaySot,
    possessionHome: homePoss || null,
    possessionAway: awayPoss || null,
    cornersHome: homeCorners,
    cornersAway: awayCorners,
  };
}

/** Sofascore attempt — succeeds when Akamai allows the server IP. */
export async function fetchSofaLiveRaw(): Promise<unknown[] | null> {
  const headers = {
    ...BROWSER_HEADERS,
    Origin: "https://www.sofascore.com",
    Referer: "https://www.sofascore.com/",
    "X-Requested-With": "XMLHttpRequest",
  };
  const urls = [
    "https://api.sofascore.com/api/v1/sport/football/events/live",
    "https://www.sofascore.com/api/v1/sport/football/events/live",
  ];
  for (const url of urls) {
    const data = await fetchJson<{ events?: unknown[] }>(url, headers, 50_000);
    if (data?.events) return data.events;
  }
  return null;
}

export async function fetchTheSportsDbDay(): Promise<NormalizedEvent[]> {
  const data = await fetchJson<{
    events?: Array<{
      idEvent: string;
      strEvent?: string;
      strHomeTeam?: string;
      strAwayTeam?: string;
      intHomeScore?: string | null;
      intAwayScore?: string | null;
      strLeague?: string;
      strStatus?: string;
      strTimestamp?: string;
      strProgress?: string;
    }>;
  }>(
    `https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=${todayIso()}&s=Soccer`,
    BROWSER_HEADERS,
    90_000
  );

  return (data?.events || [])
    .filter((e) =>
      isWhitelistedEvent({
        leagueKey: e.strLeague || "",
        competition: e.strLeague || "",
      })
    )
    .map((e) => {
      const progress = (e.strProgress || "").replace("'", "");
      const minute = Number(progress);
      const statusRaw = (e.strStatus || "").toLowerCase();
      let status: NormalizedEvent["status"] = "scheduled";
      if (statusRaw.includes("half") || e.strProgress === "HT") status = "halftime";
      else if (statusRaw.includes("finished") || statusRaw === "ft") status = "finished";
      else if (e.strProgress && e.strProgress !== "0") status = "live";

      return {
        id: `tsdb-${e.idEvent}`,
        source: "thesportsdb" as const,
        leagueKey: e.strLeague || "football",
        competition: e.strLeague || "Football",
        homeTeam: e.strHomeTeam || "Home",
        awayTeam: e.strAwayTeam || "Away",
        homeScore: Number(e.intHomeScore || 0),
        awayScore: Number(e.intAwayScore || 0),
        status,
        minute: Number.isFinite(minute) ? minute : null,
        kickoff: e.strTimestamp || null,
      };
    });
}

/** Known public seasonal GPG approximations + live sample when enough finished games exist. */
export async function leagueGoalAverage(leagueKey: string, events: NormalizedEvent[]): Promise<number> {
  const finished = events.filter(
    (e) => e.leagueKey === leagueKey && e.status === "finished"
  );
  if (finished.length >= 3) {
    const total = finished.reduce((s, e) => s + e.homeScore + e.awayScore, 0);
    return Math.round((total / finished.length) * 100) / 100;
  }

  return WHITELIST_GPG_BASELINES[leagueKey] ?? 0;
}

export async function fetchAllNormalizedEvents(): Promise<{
  events: NormalizedEvent[];
  source: string;
}> {
  const espn = (await fetchEspnEvents()).filter(isWhitelistedEvent);
  if (espn.length) {
    return { events: espn, source: "espn" };
  }

  const sofa = await fetchSofaLiveRaw();
  if (sofa?.length) {
    const mapped: NormalizedEvent[] = (sofa as Array<Record<string, unknown>>)
      .map((raw) => {
        const e = raw as {
          id: number;
          homeTeam: { name: string };
          awayTeam: { name: string };
          homeScore?: { current?: number };
          awayScore?: { current?: number };
          status?: { code?: number; description?: string; type?: string };
          tournament?: { uniqueTournament?: { id: number; name: string }; name?: string };
          startTimestamp?: number;
        };
        const desc = (e.status?.description || "").toLowerCase();
        let status: NormalizedEvent["status"] = "scheduled";
        if (e.status?.code === 7 || desc.includes("halftime")) status = "halftime";
        else if (e.status?.type === "inprogress") status = "live";
        else if (e.status?.type === "finished") status = "finished";

        return {
          id: `sofa-${e.id}`,
          source: "sofascore" as const,
          leagueKey: String(e.tournament?.uniqueTournament?.id || "unknown"),
          competition:
            e.tournament?.uniqueTournament?.name || e.tournament?.name || "Football",
          homeTeam: e.homeTeam.name,
          awayTeam: e.awayTeam.name,
          homeScore: e.homeScore?.current ?? 0,
          awayScore: e.awayScore?.current ?? 0,
          status,
          minute: null,
          kickoff: e.startTimestamp
            ? new Date(e.startTimestamp * 1000).toISOString()
            : null,
        };
      })
      .filter(isWhitelistedEvent);

    if (mapped.length) return { events: mapped, source: "sofascore" };
  }

  const tsdb = (await fetchTheSportsDbDay()).filter(isWhitelistedEvent);
  return { events: tsdb, source: tsdb.length ? "thesportsdb" : "none" };
}

// Backwards-compatible aliases used by detectors
export type SofaEvent = NormalizedEvent;

export function estimateMinute(event: NormalizedEvent): number | null {
  return event.minute;
}

export function isHalftimeWindow(event: NormalizedEvent): boolean {
  if (event.status === "halftime") return true;
  return event.minute != null && event.minute >= 45 && event.minute <= 48;
}

export function isHighTempoLeague(event: NormalizedEvent): boolean {
  return isWhitelistedEvent(event);
}

export function competitionName(event: NormalizedEvent): string {
  return event.competition;
}

export function scoreLine(event: NormalizedEvent): string {
  return `${event.homeScore} : ${event.awayScore}`;
}

export async function fetchEventStatistics(event: NormalizedEvent): Promise<MatchShotStats | null> {
  if (event.espnLeague && event.espnEventId) {
    return fetchEspnMatchStats(event.espnLeague, event.espnEventId);
  }
  return null;
}
