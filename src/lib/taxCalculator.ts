import type { BetLegInput, SlipStatus, TaxBreakdown } from "./types";

const TAX_RATE = 0.12;

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function productOdds(legs: BetLegInput[]): number {
  if (!legs.length) return 0;
  return round2(legs.reduce((acc, leg) => acc * (Number(leg.odds) || 1), 1));
}

/**
 * Tanzania statutory settlement:
 * - WON: gross_profit = stake*odds - stake; tax = gross_profit*0.12; net_profit = gross_profit*0.88; net_return = stake + net_profit
 * - LOST: net_profit = -stake
 * - PUSH / VOID: net_profit = 0 (stake returned in full)
 * - Partial Push: drop 1.00 legs, then apply WON formula on remaining multiplier
 */
export function calculateSettlement(
  stake: number,
  legs: BetLegInput[],
  status: SlipStatus | string,
  taxRate = TAX_RATE
): TaxBreakdown {
  const safeStake = Number(stake) || 0;
  let activeLegs = legs.filter((l) => Number(l.odds) > 0);

  if (status === "Partial Push") {
    activeLegs = activeLegs.filter((l) => Number(l.odds) !== 1);
    if (activeLegs.length === 0) {
      return {
        totalOdds: 1,
        grossPayout: safeStake,
        grossProfit: 0,
        taxPaid: 0,
        netProfit: 0,
        netReturn: safeStake,
      };
    }
  }

  const totalOdds = productOdds(activeLegs);
  const grossPayout = round2(safeStake * totalOdds);

  if (status === "Pending") {
    return {
      totalOdds,
      grossPayout,
      grossProfit: 0,
      taxPaid: 0,
      netProfit: 0,
      netReturn: 0,
    };
  }

  if (status === "Lost") {
    return {
      totalOdds,
      grossPayout,
      grossProfit: -safeStake,
      taxPaid: 0,
      netProfit: round2(-safeStake),
      netReturn: 0,
    };
  }

  if (status === "Void or Push") {
    return {
      totalOdds: 1,
      grossPayout: safeStake,
      grossProfit: 0,
      taxPaid: 0,
      netProfit: 0,
      netReturn: safeStake,
    };
  }

  // Won or Partial Push with remaining active legs
  const grossProfit = round2(grossPayout - safeStake);
  const taxPaid = round2(Math.max(0, grossProfit) * taxRate);
  const netProfit = round2(grossProfit * (1 - taxRate));
  const netReturn = round2(safeStake + netProfit);

  return {
    totalOdds,
    grossPayout,
    grossProfit,
    taxPaid,
    netProfit,
    netReturn,
  };
}

export { TAX_RATE };
