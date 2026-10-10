/**
 * Static historical possession averages for whitelist leagues.
 * Used for PRE-MATCH corner compression only — never live boxscore possession.
 */

const EPL: Record<string, number> = {
  arsenal: 64,
  "manchester city": 66,
  "man city": 66,
  chelsea: 62,
  liverpool: 63,
  tottenham: 61,
  "tottenham hotspur": 61,
  "spurs": 61,
  "manchester united": 55,
  "man united": 55,
  newcastle: 54,
  "newcastle united": 54,
  brighton: 53,
  "brighton & hove albion": 53,
  "aston villa": 52,
  "west ham": 48,
  "west ham united": 48,
  fulham: 51,
  "crystal palace": 47,
  brentford: 48,
  bournemouth: 39,
  "afc bournemouth": 39,
  wolverhampton: 46,
  "wolves": 46,
  "wolverhampton wanderers": 46,
  everton: 44,
  "nottingham forest": 43,
  forest: 43,
  leeds: 38,
  "leeds united": 38,
  burnley: 37,
  "sheffield united": 35,
  luton: 36,
  "luton town": 36,
  ipswich: 40,
  "ipswich town": 40,
  southampton: 42,
  leicester: 45,
  "leicester city": 45,
};

const BUNDESLIGA: Record<string, number> = {
  "bayern munich": 65,
  "bayern münchen": 65,
  "bayer leverkusen": 60,
  "borussia dortmund": 58,
  "rb leipzig": 57,
  "vfb stuttgart": 55,
  "eintracht frankfurt": 52,
  "wolfsburg": 50,
  "vfl wolfsburg": 50,
  "tsg hoffenheim": 49,
  "borussia monchengladbach": 51,
  "mainz": 46,
  "1. fsv mainz 05": 46,
  "sc freiburg": 48,
  "werder bremen": 47,
  "fc augsburg": 43,
  "1. fc union berlin": 44,
  "union berlin": 44,
  "hamburger sv": 42,
  hamburg: 42,
  "sv elversberg": 40,
  "sc paderborn 07": 41,
  paderborn: 41,
};

const BUNDESLIGA_2: Record<string, number> = {
  "1. fc nürnberg": 52,
  "nürnberg": 52,
  "hannover 96": 51,
  "sv darmstadt 98": 50,
  darmstadt: 50,
  "1. fc magdeburg": 49,
  magdeburg: 49,
  "dynamo dresden": 47,
  "energie cottbus": 44,
  "vfl osnabruck": 43,
  "vfl osnabrück": 43,
};

const EREDIVISIE: Record<string, number> = {
  "psv eindhoven": 64,
  psv: 64,
  ajax: 61,
  "ajax amsterdam": 61,
  feyenoord: 58,
  "feyenoord rotterdam": 58,
  "az alkmaar": 55,
  az: 55,
  twente: 53,
  "fc twente": 53,
  "go ahead eagles": 48,
  "sparta rotterdam": 45,
  "fortuna sittard": 44,
  "nec nijmegen": 46,
  nec: 46,
};

const UCL: Record<string, number> = {
  ...EPL,
  ...BUNDESLIGA,
  "real madrid": 60,
  barcelona: 64,
  "inter milan": 56,
  "ac milan": 55,
  "paris saint-germain": 62,
  psg: 62,
};

const BY_LEAGUE: Record<string, Record<string, number>> = {
  "eng.1": EPL,
  "ger.1": BUNDESLIGA,
  "ger.2": BUNDESLIGA_2,
  "ned.1": EREDIVISIE,
  "uefa.champions": UCL,
};

function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/fc |afc |cf |sc |1\.\s*/gi, "")
    .replace(/[^a-z0-9\s&]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Look up static historical possession %. Returns null if unknown. */
export function lookupPossession(
  teamName: string,
  leagueKey?: string
): number | null {
  const key = normalizeTeamName(teamName);
  const pools: Record<string, number>[] = [];
  if (leagueKey && BY_LEAGUE[leagueKey]) pools.push(BY_LEAGUE[leagueKey]);
  pools.push(EPL, BUNDESLIGA, BUNDESLIGA_2, EREDIVISIE, UCL);

  for (const pool of pools) {
    if (pool[key] != null) return pool[key];
    // Fuzzy contains match (e.g. "Arsenal FC" → arsenal)
    for (const [name, pct] of Object.entries(pool)) {
      if (key.includes(name) || name.includes(key)) return pct;
    }
  }
  return null;
}

export function isElitePossessionSide(possession: number): boolean {
  return possession >= 62;
}
