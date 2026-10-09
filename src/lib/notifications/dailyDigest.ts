import { ensureSettings, prisma } from "@/lib/prisma";
import { isWhitelistedEvent } from "@/lib/leagueWhitelist";
import { formatKickoffEAT } from "@/lib/executionState";
import { fetchAllNormalizedEvents, leagueGoalAverage } from "@/lib/scraper/sofascore";
import {
  StandingRow,
  fetchLeagueStandings,
  fetchMatchOdds,
  fetchRecentEventIdsForTeams,
  fetchTeamPossessionAverage,
  isLowerTable,
  teamGpg,
} from "@/lib/scraper/teamProfiles";
import { getMailConfig, sendMail } from "./mailer";
import {
  DigestMatchCard,
  buildDigestHtml,
  buildDigestSubject,
  buildDigestText,
  todayDateEAT,
} from "./digestTemplate";

function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://104.219.236.43:3080"
  ).replace(/\/$/, "");
}

function kickoffEATLabel(kickoff?: string | null): string {
  return formatKickoffEAT(kickoff) || "Kickoff: TBD EAT";
}

async function evaluateFixture(
  event: {
    id: string;
    leagueKey: string;
    competition: string;
    homeTeam: string;
    awayTeam: string;
    homeTeamId?: string;
    awayTeamId?: string;
    kickoff: string | null;
    espnLeague?: string;
    espnEventId?: string;
    status: string;
  },
  standings: StandingRow[],
  leagueGpg: number
): Promise<DigestMatchCard[]> {
  // Morning digest is pre-match only
  if (event.status !== "scheduled") return [];

  const cards: DigestMatchCard[] = [];
  const league = event.espnLeague || event.leagueKey;
  const eventId = event.espnEventId;
  if (!eventId || !league) return cards;

  const homeRow =
    standings.find((s) => s.teamId === event.homeTeamId) ||
    standings.find((s) => s.name === event.homeTeam);
  const awayRow =
    standings.find((s) => s.teamId === event.awayTeamId) ||
    standings.find((s) => s.name === event.awayTeam);

  const odds = await fetchMatchOdds(league, eventId);
  const recent = await fetchRecentEventIdsForTeams(league, eventId);
  const homeId = event.homeTeamId || recent.homeTeamId;
  const awayId = event.awayTeamId || recent.awayTeamId;

  let homePoss: number | null = null;
  let awayPoss: number | null = null;
  if (homeId) homePoss = await fetchTeamPossessionAverage(league, homeId, recent.home);
  if (awayId) awayPoss = await fetchTeamPossessionAverage(league, awayId, recent.away);

  // Odds/form proxy when possession samples unavailable
  const heavyHomeFavorite =
    Boolean(odds?.homeFavorite && odds?.awayUnderdog) &&
    (odds?.homeMoneyLine != null ? odds.homeMoneyLine <= -150 : true);
  const awayLowerTable = isLowerTable(awayRow, standings.length);

  if (homePoss == null && awayPoss == null && heavyHomeFavorite && awayLowerTable) {
    homePoss = 65;
    awayPoss = 35;
  }

  // --- Corner Compression ---
  if (
    homePoss != null &&
    awayPoss != null &&
    homePoss >= 62 &&
    awayPoss <= 40 &&
    homePoss - awayPoss >= 20 &&
    (heavyHomeFavorite || awayLowerTable || (odds?.awayUnderdog ?? false))
  ) {
    const delta = Math.round(homePoss - awayPoss);
    cards.push({
      competition: event.competition,
      kickoffEAT: kickoffEATLabel(event.kickoff),
      homeTeam: event.homeTeam,
      awayTeam: event.awayTeam,
      strategy: "corner_compression",
      strategyLabel: "[Corner Compression Reticle]",
      tacticalDelta: `Home Possession ${homePoss}% vs ${awayPoss}% (+${delta}% delta)${
        awayLowerTable ? " · Away side lower-table / deep block profile" : ""
      }${heavyHomeFavorite ? " · Home heavy favorite" : ""}`,
      primaryLine: "Home Team Over 5.5 Corners",
      fallbackLine: "Total Match Corners Over 8.5 / 9.5",
      expectedVolume: "Projected range: 10 - 13 total corners",
      oddsRange: "1.48 - 1.60",
    });
  }

  // --- Strategy D Goal Volume ---
  const homeGpg = teamGpg(homeRow);
  const awayGpg = teamGpg(awayRow);
  const combinedTeamGpg =
    homeGpg != null && awayGpg != null
      ? Math.round(((homeGpg + awayGpg) / 2) * 100) / 100
      : null;
  const scoringProfile =
    combinedTeamGpg != null ? combinedTeamGpg : leagueGpg;
  const qualifiesGoalVolume = scoringProfile >= 3.0 || leagueGpg >= 3.0;

  if (qualifiesGoalVolume) {
    cards.push({
      competition: event.competition,
      kickoffEAT: kickoffEATLabel(event.kickoff),
      homeTeam: event.homeTeam,
      awayTeam: event.awayTeam,
      strategy: "goal_volume",
      strategyLabel: "[Goal Volume Radar]",
      tacticalDelta: `Scoring profile ${scoringProfile.toFixed(2)} GPG (league avg ${leagueGpg.toFixed(
        2
      )}${
        homeGpg != null && awayGpg != null
          ? ` · teams ${homeGpg.toFixed(2)} / ${awayGpg.toFixed(2)}`
          : ""
      })`,
      primaryLine: "Asian Over 2.0 Goals",
      fallbackLine: "Full Match Over 1.5 Goals",
      expectedVolume: "High-tempo whitelist league — push cushion on exactly 2 goals via Asian 2.0",
      oddsRange: "1.35 - 1.55",
    });
  }

  return cards;
}

export interface DailyDigestResult {
  digestDate: string;
  alreadyRan: boolean;
  sent: boolean;
  qualifyingCount: number;
  statusMessage: string;
  matches: DigestMatchCard[];
}

export async function runDailyMorningDigest(options?: {
  force?: boolean;
}): Promise<DailyDigestResult> {
  const digestDate = todayDateEAT();
  const force = Boolean(options?.force);

  const existing = await prisma.digestLog.findUnique({
    where: { digestDate },
  });
  if (existing && !force) {
    return {
      digestDate,
      alreadyRan: true,
      sent: existing.sent,
      qualifyingCount: existing.qualifyingCount,
      statusMessage: existing.statusMessage,
      matches: [],
    };
  }

  const settings = await ensureSettings();
  const cfg = getMailConfig();
  const to = settings.alertEmail || cfg.defaultTo;

  const { events } = await fetchAllNormalizedEvents();
  const todays = events.filter(
    (e) =>
      isWhitelistedEvent(e) &&
      e.status === "scheduled" &&
      e.espnLeague &&
      e.espnEventId
  );

  // Group standings by league
  const leagues = Array.from(new Set(todays.map((e) => e.espnLeague!).filter(Boolean)));
  const standingsMap = new Map<string, StandingRow[]>();
  const gpgMap = new Map<string, number>();
  await Promise.all(
    leagues.map(async (league) => {
      standingsMap.set(league, await fetchLeagueStandings(league));
      gpgMap.set(league, await leagueGoalAverage(league, events));
    })
  );

  const matches: DigestMatchCard[] = [];
  for (const event of todays) {
    const league = event.espnLeague!;
    const cards = await evaluateFixture(
      event,
      standingsMap.get(league) || [],
      gpgMap.get(league) || 0
    );
    matches.push(...cards);
  }

  // Dedupe identical fixture+strategy cards
  const dedup = new Map<string, DigestMatchCard>();
  for (const m of matches) {
    const key = `${m.homeTeam}|${m.awayTeam}|${m.strategy}`;
    if (!dedup.has(key)) dedup.set(key, m);
  }
  const unique = Array.from(dedup.values());

  if (unique.length === 0) {
    const statusMessage =
      "Daily scan completed: 0 qualifying opportunities found.";
    await prisma.digestLog.upsert({
      where: { digestDate },
      create: {
        digestDate,
        qualifyingCount: 0,
        sent: false,
        statusMessage,
      },
      update: {
        qualifyingCount: 0,
        sent: false,
        statusMessage,
      },
    });
    return {
      digestDate,
      alreadyRan: false,
      sent: false,
      qualifyingCount: 0,
      statusMessage,
      matches: [],
    };
  }

  if (!settings.emailEnabled) {
    const statusMessage = `Daily scan found ${unique.length} matchups but email alerts are disabled.`;
    await prisma.digestLog.upsert({
      where: { digestDate },
      create: {
        digestDate,
        qualifyingCount: unique.length,
        sent: false,
        statusMessage,
      },
      update: {
        qualifyingCount: unique.length,
        sent: false,
        statusMessage,
      },
    });
    return {
      digestDate,
      alreadyRan: false,
      sent: false,
      qualifyingCount: unique.length,
      statusMessage,
      matches: unique,
    };
  }

  const trackerUrl = `${appBaseUrl()}/?tab=scanner`;
  const subject = buildDigestSubject(unique.length, digestDate);
  await sendMail({
    to,
    subject,
    html: buildDigestHtml({ digestDate, matches: unique, trackerUrl }),
    text: buildDigestText({ digestDate, matches: unique, trackerUrl }),
  });

  const statusMessage = `Daily digest sent: ${unique.length} high-probability matchups.`;
  await prisma.digestLog.upsert({
    where: { digestDate },
    create: {
      digestDate,
      qualifyingCount: unique.length,
      sent: true,
      statusMessage,
    },
    update: {
      qualifyingCount: unique.length,
      sent: true,
      statusMessage,
    },
  });

  // Also mark notification log for digest-level dedupe
  await prisma.notificationLog.upsert({
    where: {
      eventKey_stage: { eventKey: `digest-${digestDate}`, stage: "daily_digest" },
    },
    create: {
      eventKey: `digest-${digestDate}`,
      stage: "daily_digest",
      subject,
    },
    update: { subject },
  });

  return {
    digestDate,
    alreadyRan: false,
    sent: true,
    qualifyingCount: unique.length,
    statusMessage,
    matches: unique,
  };
}
