export type Strategy =
  | "Strategy A (Multi Favorite Accumulator)"
  | "Strategy B (Daily Action Pot)"
  | "Strategy C (Elite Team Alternative Double)"
  | "Strategy D (High Tempo Goal Engine)"
  | "Custom Live Trigger (Halftime 0 : 0)";

export type SlipStatus =
  | "Pending"
  | "Won"
  | "Lost"
  | "Void or Push"
  | "Partial Push";

export type OpportunityBadge = "Live" | "Halftime" | "Upcoming";

export type OpportunityType =
  | "halftime_00"
  | "goal_volume"
  | "corner_compression";

export interface Opportunity {
  id: string;
  type: OpportunityType;
  badge: OpportunityBadge;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  competitionId?: number;
  eventId?: number;
  minute?: number | null;
  score?: string;
  shotsTotal?: number | null;
  shotsOnTarget?: number | null;
  possessionHome?: number | null;
  possessionAway?: number | null;
  leagueAvgGoals?: number | null;
  recommendedMarket: string;
  recommendedEntry?: string;
  rationale: string;
  suggestedOdds?: number | null;
  kickoff?: string | null;
  detectedAt: string;
}

export interface BetLegInput {
  matchName: string;
  market: string;
  odds: number;
}

export interface BetSlipInput {
  date: string;
  strategy: Strategy | string;
  stake: number;
  status: SlipStatus | string;
  notes?: string;
  legs: BetLegInput[];
  totalOdds?: number;
}

export interface TaxBreakdown {
  totalOdds: number;
  grossPayout: number;
  grossProfit: number;
  taxPaid: number;
  netProfit: number;
  netReturn: number;
}

export const STRATEGIES: Strategy[] = [
  "Strategy A (Multi Favorite Accumulator)",
  "Strategy B (Daily Action Pot)",
  "Strategy C (Elite Team Alternative Double)",
  "Strategy D (High Tempo Goal Engine)",
  "Custom Live Trigger (Halftime 0 : 0)",
];

export const STATUSES: SlipStatus[] = [
  "Pending",
  "Won",
  "Lost",
  "Void or Push",
  "Partial Push",
];
