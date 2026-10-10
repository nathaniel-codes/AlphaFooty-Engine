import { ensureSettings, prisma } from "@/lib/prisma";
import { isWhitelistedEvent } from "@/lib/leagueWhitelist";
import { fetchAllNormalizedEvents } from "@/lib/scraper/sofascore";
import { StandingRow, fetchLeagueStandings } from "@/lib/scraper/teamProfiles";
import {
  ScannedOpportunity,
  scanFixture,
  selectTopDigestOpportunities,
} from "@/lib/scanner/fixtureScanner";
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

function toDigestCard(op: ScannedOpportunity): DigestMatchCard {
  return {
    competition: op.competition,
    kickoffEAT: op.kickoffEAT,
    homeTeam: op.homeTeam,
    awayTeam: op.awayTeam,
    strategy: op.strategy,
    strategyLabel: op.strategyLabel,
    tacticalDelta: op.tacticalDelta,
    primaryLine: op.primaryLine,
    fallbackLine: op.fallbackLine,
    expectedVolume: op.expectedVolume,
    oddsRange: op.oddsRange,
    edgeScore: op.edgeScore,
  };
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
  // Only hard-lock after a successful send
  if (existing?.sent && !force) {
    return {
      digestDate,
      alreadyRan: true,
      sent: true,
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

  const leagues = Array.from(new Set(todays.map((e) => e.espnLeague!).filter(Boolean)));
  const standingsMap = new Map<string, StandingRow[]>();
  await Promise.all(
    leagues.map(async (league) => {
      standingsMap.set(league, await fetchLeagueStandings(league));
    })
  );

  const scanned: ScannedOpportunity[] = [];
  for (const event of todays) {
    const league = event.espnLeague!;
    scanned.push(...scanFixture(event, standingsMap.get(league) || []));
  }

  // Dedupe fixture+strategy, then cap to top 3–5 highest edge
  const dedup = new Map<string, ScannedOpportunity>();
  for (const op of scanned) {
    const key = `${op.homeTeam}|${op.awayTeam}|${op.strategy}`;
    const prev = dedup.get(key);
    if (!prev || op.edgeScore > prev.edgeScore) dedup.set(key, op);
  }

  const unique = selectTopDigestOpportunities(Array.from(dedup.values()), 5);
  const matches = unique.map(toDigestCard);

  if (matches.length === 0) {
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
    const statusMessage = `Daily scan found ${matches.length} matchups but email alerts are disabled.`;
    await prisma.digestLog.upsert({
      where: { digestDate },
      create: {
        digestDate,
        qualifyingCount: matches.length,
        sent: false,
        statusMessage,
      },
      update: {
        qualifyingCount: matches.length,
        sent: false,
        statusMessage,
      },
    });
    return {
      digestDate,
      alreadyRan: false,
      sent: false,
      qualifyingCount: matches.length,
      statusMessage,
      matches,
    };
  }

  const trackerUrl = `${appBaseUrl()}/?tab=scanner`;
  const subject = buildDigestSubject(matches.length, digestDate);
  await sendMail({
    to,
    subject,
    html: buildDigestHtml({ digestDate, matches, trackerUrl }),
    text: buildDigestText({ digestDate, matches, trackerUrl }),
  });

  const statusMessage = `Daily digest sent: ${matches.length} high-probability matchups.`;
  await prisma.digestLog.upsert({
    where: { digestDate },
    create: {
      digestDate,
      qualifyingCount: matches.length,
      sent: true,
      statusMessage,
    },
    update: {
      qualifyingCount: matches.length,
      sent: true,
      statusMessage,
    },
  });

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
    qualifyingCount: matches.length,
    statusMessage,
    matches,
  };
}
