import { describe, it, expect } from "vitest";
import { FinalDecisionEngine, computeBinomialPValue } from "./final-decision";
import { SignificanceGuardEngine, type ComboEvidence } from "../risk/significance-guard";
import { CircuitBreakerEngine, idleCircuitBreaker } from "../risk/circuit-breaker";
import { PortfolioExposureEngine } from "../risk/portfolio-exposure";
import { PositionSizingEngine } from "../risk/position-sizing";
import { scanNow, DEFAULT_SCAN_OPTIONS } from "../apex/scan";
import { APEX_UNIVERSE_SYMBOLS } from "../apex/universe";
import { PROPOSITIONS, type Proposition } from "./observation/constants";
import type { MarketIntel, ContractEval, RankedOpportunity } from "../apex/types";
import type { OpportunityCandidate } from "@/types/sentinel";

function createMockContracts(marketId: string, biasDigit: number, baseDanger: number = 15): ContractEval[] {
  return PROPOSITIONS.map((prop: Proposition): ContractEval => {
    const side = prop.startsWith("OVER") ? "OVER" : "UNDER";
    const barrier = parseInt(prop.replace(/\D/g, ""), 10) || (side === "OVER" ? 2 : 7);
    const winners =
      side === "OVER"
        ? Array.from({ length: 9 - barrier }, (_, i) => barrier + 1 + i)
        : Array.from({ length: barrier }, (_, i) => i);
    const theoretical = winners.length / 10;
    const isWinningBias = winners.includes(biasDigit);
    const empirical = isWinningBias ? theoretical + 0.08 : theoretical - 0.04;
    const compositeEdge = empirical - theoretical;

    return {
      id: prop as any,
      label: `${side === "OVER" ? "Over" : "Under"} ${barrier}`,
      side,
      barrier,
      winners,
      theoretical,
      empirical,
      recent: empirical,
      micro: empirical,
      n: 1000,
      edge: compositeEdge,
      edgeLB: compositeEdge * 0.8,
      pressureAsymmetry: 0.15,
      transitionSupport: 0.1,
      compositeEdge,
      stability: 85,
      freshness: 90,
      quality: 85,
      danger: baseDanger,
      confidence: 82,
      opportunity: 78,
      phase: "MATURE",
      supports: [{ engine: "Distribution", label: "Strong positive bias", weight: 1.5 }],
      conflicts: [],
      contradiction: 0,
      ageTicks: 1000,
      threat: null,
      critical: null,
      stats: null,
      rate: null,
      ensemble: null,
      forward: null,
      analogue: null,
      fakeEdge: null,
      regimeCompatible: true,
      regimeNote: "Compatible",
      threatPenalty: 0,
      alerts: [],
    };
  });
}

function createMockMarket(symbol: string, name: string, biasDigit: number = 7, tickCount: number = 1000, dangerVal: number = 15): MarketIntel {
  const pcts = Array(10).fill(0.08);
  pcts[biasDigit] = 0.28;

  const digits: number[] = [];
  for (let i = 0; i < tickCount; i++) {
    const r = Math.random();
    if (r < 0.28) {
      digits.push(biasDigit);
    } else {
      digits.push(Math.floor(Math.random() * 10));
    }
  }

  const contracts = createMockContracts(symbol, biasDigit, dangerVal);

  return {
    symbol,
    name,
    dataState: "OK",
    ticks: tickCount,
    lastTickAt: Date.now() - 500,
    ageMs: 500,
    digits,
    contracts,
    best: contracts[0],
    stats: {
      total: tickCount,
      counts: pcts.map((p) => Math.round(p * tickCount)),
      pct: pcts,
      recentPct: pcts,
      dominant: biasDigit,
      least: (biasDigit + 5) % 10,
      entropy: 0.85,
      evenPct: 0.5,
      oddPct: 0.5,
      highPct: biasDigit >= 5 ? 0.65 : 0.35,
      lowPct: biasDigit < 5 ? 0.65 : 0.35,
    },
    pressure: {
      window15: { winner: "OVER", overPct: 0.65, underPct: 0.35, net: 0.3 },
      window30: { winner: "OVER", overPct: 0.62, underPct: 0.38, net: 0.24 },
      window60: { winner: "OVER", overPct: 0.60, underPct: 0.40, net: 0.20 },
      window120: { winner: "OVER", overPct: 0.58, underPct: 0.42, net: 0.16 },
      trend: "OVER",
      bias: "OVER",
      velocity: 0.15,
      acceleration: 0.05,
      net: 0.22,
    },
    transition: null,
    sequence: null,
    entropy: {
      entropy: 0.82,
      maxEntropy: 1.0,
      normalized: 0.82,
      regime: "TRENDING",
      isUniform: false,
    },
    anomaly: null,
    volatility: {
      ratio: 1.05,
      state: "NORMAL",
      stdev: 0.12,
      mean: 0.1,
    },
    trend: null,
    regime: {
      id: "TRENDING",
      label: "TRENDING",
      confidence: 85,
      sampleSize: tickCount,
      stability: 90,
      summary: "Stable directional trend detected.",
    },
    personality: null,
    buildup: null,
    quality: {
      overallScore: 82,
      grade: "A",
      liquidity: 90,
      stability: 85,
      signalToNoise: 80,
      summary: "High quality streaming data.",
    },
    danger: dangerVal,
    updatedAt: Date.now(),
    digitIntel: null,
    bars: null,
    criticalReport: null,
    battle: null,
    deepTicks: tickCount,
    psychology: null,
    specialDigits: null,
    fluctuation: {
      score: 18,
      state: "CALM",
      flickerRate: 0.02,
      summary: "Calm market environment with low noise.",
    },
  };
}

describe("Stage 4 Master Verification Test Suite (Tests 1 - 10)", () => {
  const mockMarkets = APEX_UNIVERSE_SYMBOLS.map((s, idx) =>
    createMockMarket(s, `${s} Synthetic Index`, (idx * 2) % 10, 1000),
  );

  // TEST 1: Stage 4 receives the candidate population and records its actual size.
  it("Test 1: Stage 4 receives the candidate population and records its actual size", () => {
    const scan = scanNow(mockMarkets, DEFAULT_SCAN_OPTIONS);
    expect(scan.evaluated).toBe(90);
    expect(scan.bestOf90).not.toBeNull();
    expect(scan.bestOf90!.populationSize).toBe(90);
    expect(scan.exposureReport).toBeDefined();
    expect(scan.bestOf90!.candidate.finalDecision).toBeDefined();
    expect(scan.bestOf90!.candidate.finalDecision?.significance?.activeComparisons).toBe(90);
  });

  // TEST 2: SignificanceGuardEngine applies multiple-testing correction across the candidate population.
  it("Test 2: SignificanceGuardEngine applies Benjamini-Hochberg FDR across the candidate population", () => {
    const mockEvidences: ComboEvidence[] = [
      { comboKey: "R_100:UNDER_7", pVal: 0.001, rawWilsonLower: 73.5, measuredEdge: 5.2, sampleSize: 1000 },
      { comboKey: "R_75:UNDER_7", pVal: 0.04, rawWilsonLower: 70.8, measuredEdge: 2.1, sampleSize: 1000 },
      { comboKey: "R_50:OVER_2", pVal: 0.08, rawWilsonLower: 70.2, measuredEdge: 1.6, sampleSize: 1000 },
      { comboKey: "R_25:UNDER_8", pVal: 0.35, rawWilsonLower: 79.5, measuredEdge: 0.5, sampleSize: 1000 },
    ];

    const result = SignificanceGuardEngine.evaluateAll(mockEvidences);
    expect(result.size).toBe(4);
    expect(result.get("R_100:UNDER_7")?.passesCorrection).toBe(true);
    expect(result.get("R_25:UNDER_8")?.passesCorrection).toBe(false); // edge 0.5 < 1.5 and p-value too high
  });

  // TEST 3: A Stage-3 CLEARED candidate with unconfirmed significance becomes HELD_UNCONFIRMED_SIGNIFICANCE.
  it("Test 3: A Stage-3 CLEARED candidate with unconfirmed significance becomes HELD_UNCONFIRMED_SIGNIFICANCE", () => {
    const dummyCandidate: Partial<RankedOpportunity> = {
      symbol: "R_100",
      contract: {
        id: "UNDER_7" as any,
        label: "Under 7",
        theoretical: 0.7,
        empirical: 0.702, // only 0.2pp edge - fails Minimum Effect Size (1.5pp)
        n: 1000,
        edge: 0.002,
        edgeLB: 0,
        danger: 15,
        confidence: 80,
      } as any,
      score: 85,
      entryClearance: { verdict: "CLEARED" } as any,
      blocked: false,
    };

    const cb = idleCircuitBreaker();
    const { ranked } = FinalDecisionEngine.evaluateStage4([dummyCandidate as RankedOpportunity], cb, []);

    expect(ranked[0].finalDecision?.stage3Verdict).toBe("CLEARED");
    expect(ranked[0].finalDecision?.significance?.passesCorrection).toBe(false);
    expect(ranked[0].finalDecision?.verdict).toBe("HELD_UNCONFIRMED_SIGNIFICANCE");
  });

  // TEST 4: A Stage-3 WAIT or BLOCKED candidate is never promoted by Stage 4.
  it("Test 4: A Stage-3 WAIT or BLOCKED candidate is never promoted by Stage 4", () => {
    const waitCand: Partial<RankedOpportunity> = {
      symbol: "R_100",
      contract: {
        id: "UNDER_7" as any,
        label: "Under 7",
        theoretical: 0.7,
        empirical: 0.78, // massive 8pp edge and massive sample
        n: 1000,
        edge: 0.08,
        edgeLB: 0.06,
        danger: 15,
        confidence: 90,
      } as any,
      score: 88,
      entryClearance: { verdict: "WAIT" } as any,
      blocked: false,
    };

    const blockedCand: Partial<RankedOpportunity> = {
      symbol: "R_50",
      contract: {
        id: "OVER_2" as any,
        label: "Over 2",
        theoretical: 0.7,
        empirical: 0.78,
        n: 1000,
        edge: 0.08,
        edgeLB: 0.06,
        danger: 65,
        confidence: 90,
      } as any,
      score: 80,
      entryClearance: { verdict: "BLOCKED" } as any,
      blocked: true,
    };

    const cb = idleCircuitBreaker();
    const { ranked } = FinalDecisionEngine.evaluateStage4([waitCand as RankedOpportunity, blockedCand as RankedOpportunity], cb, []);

    expect(ranked[0].finalDecision?.verdict).toBe("WAIT");
    expect(ranked[1].finalDecision?.verdict).toBe("BLOCKED");
  });

  // TEST 5: CircuitBreakerEngine trips and halts trading when limits are breached.
  it("Test 5: CircuitBreakerEngine trips and halts trading when limits are breached", () => {
    // Breached consecutive losses
    const cbLosses = CircuitBreakerEngine.evaluate({ consecutiveLosses: 4 });
    expect(cbLosses.tripped).toBe(true);
    expect(cbLosses.reason).toContain("4 consecutive losses");

    // Breached drawdown
    const cbDrawdown = CircuitBreakerEngine.evaluate({ sessionDrawdownPct: 15 });
    expect(cbDrawdown.tripped).toBe(true);
    expect(cbDrawdown.reason).toContain("session drawdown 15.0%");

    // Breached global danger
    const cbDanger = CircuitBreakerEngine.evaluate({ sustainedGlobalDanger: 85 });
    expect(cbDanger.tripped).toBe(true);
    expect(cbDanger.reason).toContain("sustained global danger 85/100");

    // Stage 4 evaluates candidate under tripped breaker
    const dummyCandidate: Partial<RankedOpportunity> = {
      symbol: "R_100",
      contract: {
        id: "UNDER_7" as any,
        label: "Under 7",
        theoretical: 0.7,
        empirical: 0.78,
        n: 1000,
        edge: 0.08,
        edgeLB: 0.06,
        danger: 15,
        confidence: 85,
      } as any,
      score: 85,
      entryClearance: { verdict: "CLEARED" } as any,
      blocked: false,
    };

    const { ranked } = FinalDecisionEngine.evaluateStage4([dummyCandidate as RankedOpportunity], cbLosses, []);
    expect(ranked[0].finalDecision?.verdict).toBe("HELD_CIRCUIT_BREAKER");
    expect(ranked[0].finalDecision?.recommendedStake?.drawdownAdjustedStake).toBe(0);
  });

  // TEST 6: PortfolioExposureEngine enforces group and total exposure ceilings.
  it("Test 6: PortfolioExposureEngine enforces group and total exposure ceilings", () => {
    const candidates = [
      {
        symbol: "R_100",
        contract: { id: "UNDER_7", label: "Under 7", theoretical: 0.7, empirical: 0.78, n: 1000, edge: 0.08, danger: 15, confidence: 85 } as any,
        score: 88,
        entryClearance: { verdict: "CLEARED" } as any,
        blocked: false,
        recommendedStake: { drawdownAdjustedStake: 15 } as any,
      },
      {
        symbol: "R_75",
        contract: { id: "UNDER_7", label: "Under 7", theoretical: 0.7, empirical: 0.78, n: 1000, edge: 0.08, danger: 15, confidence: 85 } as any,
        score: 82,
        entryClearance: { verdict: "CLEARED" } as any,
        blocked: false,
        recommendedStake: { drawdownAdjustedStake: 15 } as any,
      },
    ];

    const cb = idleCircuitBreaker();
    const { ranked, exposureReport } = FinalDecisionEngine.evaluateStage4(candidates as any, cb, []);

    expect(exposureReport.recommendation).toBe("TRIM");
    // The lower-scoring R_75 ($15 + $15 = $30 > $25 group ceiling) should be held
    const r75 = ranked.find((r) => r.symbol === "R_75");
    expect(r75?.finalDecision?.verdict).toBe("HELD_EXPOSURE_CAP");
  });

  // TEST 7: PositionSizingEngine computes drawdown-adjusted stakes from real inputs.
  it("Test 7: PositionSizingEngine computes drawdown-adjusted stakes from real inputs", () => {
    const baseStake = PositionSizingEngine.calculateBaseStake(85, 80, 78, 1.38, 1000, 1000);
    expect(baseStake.baseStake).toBeGreaterThanOrEqual(0.35);
    expect(baseStake.kellyFraction).toBeGreaterThan(0);
    expect(baseStake.maturityFactor).toBe(1.0); // 1000 ticks = full maturity

    // With consecutive losses
    const cbStreak = CircuitBreakerEngine.evaluate({ consecutiveLosses: 2 });
    const adjustedStreak = PositionSizingEngine.applyDrawdownAdjustment(baseStake, cbStreak);
    expect(adjustedStreak.drawdownAdjustedStake).toBeLessThan(baseStake.baseStake);

    // With drawdown
    const cbDrawdown = CircuitBreakerEngine.evaluate({ sessionDrawdownPct: 8 });
    const adjustedDrawdown = PositionSizingEngine.applyDrawdownAdjustment(baseStake, cbDrawdown);
    expect(adjustedDrawdown.drawdownAdjustedStake).toBeLessThan(baseStake.baseStake);
  });

  // TEST 8: Missing statistical evidence results in honest unconfirmed states, never fabricated confidence.
  it("Test 8: Missing statistical evidence results in honest unconfirmed states, never fabricated confidence", () => {
    const pValZeroSample = computeBinomialPValue(0.75, 0.7, 0);
    expect(pValZeroSample).toBe(1.0);

    const thinCandidate: Partial<RankedOpportunity> = {
      symbol: "R_10",
      contract: {
        id: "UNDER_7" as any,
        label: "Under 7",
        theoretical: 0.7,
        empirical: 0.7, // zero edge
        n: 0, // zero sample
        edge: 0,
        edgeLB: 0,
        danger: 15,
        confidence: 0,
      } as any,
      score: 50,
      entryClearance: { verdict: "CLEARED" } as any,
      blocked: false,
    };

    const cb = idleCircuitBreaker();
    const { ranked } = FinalDecisionEngine.evaluateStage4([thinCandidate as RankedOpportunity], cb, []);

    expect(ranked[0].finalDecision?.significance?.passesCorrection).toBe(false);
    expect(ranked[0].finalDecision?.significance?.detail).toContain("sample 0 below minimum 60 observations");
    expect(ranked[0].finalDecision?.verdict).toBe("HELD_UNCONFIRMED_SIGNIFICANCE");
  });

  // TEST 9: Best-of-90 reflects the final Stage 4 verdict and is passed to the UI.
  it("Test 9: Best-of-90 reflects the final Stage 4 verdict and is passed to the UI", () => {
    const scan = scanNow(mockMarkets, DEFAULT_SCAN_OPTIONS);
    expect(scan.bestOf90).not.toBeNull();
    expect(scan.bestOf90!.finalDecision).toBeDefined();
    expect(scan.bestOf90!.recommendedStake).toBeDefined();
    expect(scan.bestOf90!.candidate.finalDecision?.verdict).toBeDefined();
  });

  // TEST 10: Full pipeline test: 1000 ticks → 90 cells → psychology → direction → executionReady → operator surface gate → Stage 4 → Best-of-90.
  it("Test 10: Full pipeline test: 1000 ticks → 90 cells → psychology → direction → executionReady → operator surface gate → Stage 4 → Best-of-90", () => {
    const scan = scanNow(mockMarkets, DEFAULT_SCAN_OPTIONS);

    // 1000 ticks & 90 cells
    expect(scan.evaluated).toBe(90);
    const best = scan.bestOf90!;
    expect(best.candidate.intel.ticks).toBe(1000);

    // Psychology & Direction
    expect(best.candidate.digitPsychology).toBeDefined();
    expect(best.candidate.direction).toBeDefined();

    // Execution Ready
    expect(typeof best.executionReady).toBe("boolean");

    // Operator Surface Gate
    expect(typeof best.qualified).toBe("boolean");

    // Stage 4
    expect(best.finalDecision).toBeDefined();
    expect(best.finalDecision?.circuitBreaker).toBeDefined();
    expect(best.finalDecision?.significance).toBeDefined();
    expect(best.finalDecision?.recommendedStake).toBeDefined();

    // UI payload integrity
    expect(best.populationSize).toBe(90);
    expect(best.bestOfPopulation).toBe(true);
  });
});
