import type { Opportunity, OpportunityBadge } from "./types";

export type ActionStatus =
  | "PRE_MATCH_READY"
  | "MONITORING_FOR_HT"
  | "EXECUTE_ENTRY"
  | "WINDOW_CLOSED";

export interface ActionStatusInfo {
  key: ActionStatus;
  label: string;
  className: string;
  flashing?: boolean;
}

function parseScore(score?: string): { home: number; away: number } | null {
  if (!score || score === "vs") return null;
  const match = score.match(/(\d+)\s*[:\-]\s*(\d+)/);
  if (!match) return null;
  return { home: Number(match[1]), away: Number(match[2]) };
}

function isNilNil(score?: string): boolean {
  const parsed = parseScore(score);
  if (!parsed) return true; // upcoming / unknown treated as 0-0 for pre-match
  return parsed.home === 0 && parsed.away === 0;
}

function hasGoals(score?: string): boolean {
  const parsed = parseScore(score);
  if (!parsed) return false;
  return parsed.home > 0 || parsed.away > 0;
}

/** Derive Strategy D execution state from live score / minute / badge. */
export function getActionStatus(op: Opportunity): ActionStatusInfo {
  if (op.badge === "Upcoming") {
    return {
      key: "PRE_MATCH_READY",
      label: "PRE MATCH READY",
      className: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40",
    };
  }

  const minute = op.minute ?? null;
  const scored = hasGoals(op.score);
  const nilNil = isNilNil(op.score);

  if (scored || (minute != null && minute >= 65)) {
    return {
      key: "WINDOW_CLOSED",
      label: "WINDOW CLOSED",
      className: "bg-slate-500/20 text-slate-400 border border-slate-600/50",
    };
  }

  if (nilNil && minute != null && minute >= 58 && minute <= 62) {
    return {
      key: "EXECUTE_ENTRY",
      label: "EXECUTE ENTRY NOW (MIN 58 to 62)",
      className:
        "bg-emerald-400/25 text-emerald-200 border border-emerald-400/60 shadow-[0_0_12px_rgba(52,211,153,0.35)]",
      flashing: true,
    };
  }

  // 0-0 before entry window (pre-45, HT, or waiting for min 58)
  if (nilNil && (minute == null || minute < 58)) {
    return {
      key: "MONITORING_FOR_HT",
      label: "MONITORING FOR HT",
      className: "bg-sky-500/20 text-sky-300 border border-sky-500/40",
    };
  }

  // 0-0 after execute window but before 65, or any other live edge case
  return {
    key: "WINDOW_CLOSED",
    label: "WINDOW CLOSED",
    className: "bg-slate-500/20 text-slate-400 border border-slate-600/50",
  };
}

export function formatKickoffEAT(kickoff?: string | null): string | null {
  if (!kickoff) return null;
  const date = new Date(kickoff);
  if (Number.isNaN(date.getTime())) return null;
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Africa/Nairobi",
  }).format(date);
  return `Kickoff: ${time} EAT`;
}

export function formatCountdown(kickoff?: string | null, nowMs = Date.now()): string | null {
  if (!kickoff) return null;
  const start = new Date(kickoff).getTime();
  if (Number.isNaN(start)) return null;
  const diff = start - nowMs;
  if (diff <= 0) return "Starting now";

  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  if (days > 0) return `Starts in ${days}d ${hours}h`;
  if (hours > 0) return `Starts in ${hours}h ${mins}m`;
  if (mins > 0) return `Starts in ${mins}m`;
  return `Starts in ${secs}s`;
}

export function isUpcoming(badge: OpportunityBadge): boolean {
  return badge === "Upcoming";
}
