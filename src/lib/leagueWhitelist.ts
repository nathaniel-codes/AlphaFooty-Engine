/**
 * Strict competition whitelist for the 87.1% high-transition goal model.
 * Anything outside this set is discarded — no cards, no emails.
 */
export const WHITELIST_ESPN_KEYS: Record<string, string> = {
  "eng.1": "English Premier League",
  "ger.1": "German Bundesliga",
  "ger.2": "German 2. Bundesliga",
  "ned.1": "Dutch Eredivisie",
  "uefa.champions": "UEFA Champions League",
};

/** Sofascore uniqueTournament IDs for the same whitelist */
export const WHITELIST_SOFA_IDS: Record<number, string> = {
  17: "English Premier League",
  35: "German Bundesliga",
  44: "German 2. Bundesliga",
  37: "Dutch Eredivisie",
  7: "UEFA Champions League",
};

const NAME_PATTERNS: RegExp[] = [
  /\benglish premier league\b/i,
  /\bpremier league\b/i,
  /\b2\.?\s*bundesliga\b/i,
  /\bgerman bundesliga\b/i,
  /\bbundesliga\b/i,
  /\beredivisie\b/i,
  /\buefa champions league\b/i,
  /\bchampions league\b/i,
];

export function isWhitelistedLeagueKey(leagueKey: string): boolean {
  if (leagueKey in WHITELIST_ESPN_KEYS) return true;
  const asNum = Number(leagueKey);
  return Number.isFinite(asNum) && asNum in WHITELIST_SOFA_IDS;
}

export function isWhitelistedCompetitionName(name: string): boolean {
  const lower = (name || "").toLowerCase().trim();
  if (!lower) return false;

  // Hard excludes that can false-positive on loose name matching
  if (
    lower.includes("liga portugal") ||
    lower.includes("primeira liga") ||
    lower.includes("serie a") ||
    lower.includes("ligue 1") ||
    lower.includes("laliga") ||
    lower.includes("la liga") ||
    lower.includes("europa league") ||
    lower.includes("conference league") ||
    lower.includes("super lig") ||
    lower.includes("süper lig") ||
    (lower.includes("super league") && !lower.includes("champions")) ||
    lower.includes("championship")
  ) {
    return false;
  }

  // Plain "bundesliga" must not match non-German competitions; 2. Bundesliga handled first by patterns
  return NAME_PATTERNS.some((p) => p.test(name));
}

export function isWhitelistedEvent(event: {
  leagueKey: string;
  competition: string;
}): boolean {
  if (isWhitelistedLeagueKey(event.leagueKey)) return true;
  return isWhitelistedCompetitionName(event.competition);
}

/** GPG baselines used only for whitelisted leagues */
export const WHITELIST_GPG_BASELINES: Record<string, number> = {
  "eng.1": 2.85,
  "ger.1": 3.15,
  "ger.2": 3.05,
  "ned.1": 3.25,
  "uefa.champions": 2.95,
};
