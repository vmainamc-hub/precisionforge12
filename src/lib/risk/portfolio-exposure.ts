/**
 * RISK — PORTFOLIO EXPOSURE.
 *
 * Synthetic indices move in correlated families (all Volatility indices share
 * the same generator family, 1s variants share tick cadence). Taking several
 * "independent" positions inside one family is really one large position.
 * This engine caps combined exposure per correlation group and per portfolio.
 */

import type { OpportunityCandidate, PortfolioExposureReport } from "@/types/sentinel";

export const PORTFOLIO_CEILING = 60;
export const GROUP_CEILING = 25;

export interface HeldCandidate {
  candidate: OpportunityCandidate;
  reason: string;
}

/** Map a market symbol to its correlation family. */
export function correlationGroup(market: string): string {
  const m = (market || "").toUpperCase();
  if (m.includes("1HZ")) return "VOLATILITY_1S";
  if (m.startsWith("R_")) return "VOLATILITY_STANDARD";
  if (m.includes("JD") || m.includes("JUMP")) return "JUMP";
  if (m.includes("BOOM") || m.includes("CRASH")) return "BOOM_CRASH";
  if (m.includes("STP") || m.includes("RANGE")) return "STEP_RANGE";
  return "OTHER";
}

export class PortfolioExposureEngine {
  public static evaluateExposure(
    candidates: OpportunityCandidate[],
    openPositions: { market: string; stake: number }[] = [],
  ): { report: PortfolioExposureReport; heldCandidates: HeldCandidate[] } {
    const groups = new Map<
      string,
      { combined: number; members: string[]; candidates: OpportunityCandidate[] }
    >();

    const bump = (market: string, stake: number, member: string, cand?: OpportunityCandidate) => {
      const g = correlationGroup(market);
      const entry = groups.get(g) ?? { combined: 0, members: [], candidates: [] };
      entry.combined += stake;
      entry.members.push(member);
      if (cand) entry.candidates.push(cand);
      groups.set(g, entry);
    };

    for (const p of openPositions) bump(p.market, p.stake, `open:${p.market}`);
    for (const c of candidates) {
      const stake = c.recommendedStake?.drawdownAdjustedStake ?? 0;
      bump(c.market, stake, `${c.market} ${c.contract}`, c);
    }

    const heldCandidates: HeldCandidate[] = [];
    const byCorrelationGroup = [...groups.entries()].map(([group, e]) => {
      const breached = e.combined > GROUP_CEILING;
      if (breached) {
        // Hold the weakest candidates in the group until the group fits.
        const ordered = [...e.candidates].sort((a, b) => a.opportunityScore - b.opportunityScore);
        let running = e.combined;
        for (const cand of ordered) {
          if (running <= GROUP_CEILING) break;
          const stake = cand.recommendedStake?.drawdownAdjustedStake ?? 0;
          running -= stake;
          heldCandidates.push({
            candidate: cand,
            reason: `Correlation group ${group} at $${e.combined.toFixed(2)} exceeds the $${GROUP_CEILING.toFixed(2)} ceiling; lowest-scoring member held.`,
          });
        }
      }
      return {
        group,
        combinedExposure: Math.round(e.combined * 100) / 100,
        ceiling: GROUP_CEILING,
        breached,
        members: e.members,
      };
    });

    const totalProposedExposure =
      Math.round(byCorrelationGroup.reduce((s, g) => s + g.combinedExposure, 0) * 100) / 100;

    const anyBreached = byCorrelationGroup.some((g) => g.breached);
    const recommendation: PortfolioExposureReport["recommendation"] =
      totalProposedExposure > PORTFOLIO_CEILING ? "BLOCK_NEW" : anyBreached ? "TRIM" : "OK";

    if (recommendation === "BLOCK_NEW") {
      for (const cand of candidates) {
        if (heldCandidates.some((h) => h.candidate.id === cand.id)) continue;
        heldCandidates.push({
          candidate: cand,
          reason: `Total proposed exposure $${totalProposedExposure.toFixed(2)} exceeds the $${PORTFOLIO_CEILING.toFixed(2)} portfolio ceiling.`,
        });
      }
    }

    return {
      report: {
        totalProposedExposure,
        byCorrelationGroup,
        recommendation,
        detail:
          recommendation === "OK"
            ? `Total exposure $${totalProposedExposure.toFixed(2)} across ${byCorrelationGroup.length} correlation group(s) is within all ceilings.`
            : recommendation === "TRIM"
              ? `Group ceiling breached in ${byCorrelationGroup.filter((g) => g.breached).map((g) => g.group).join(", ")}; weakest members held.`
              : `Portfolio ceiling breached at $${totalProposedExposure.toFixed(2)}; no new exposure accepted.`,
      },
      heldCandidates,
    };
  }
}
