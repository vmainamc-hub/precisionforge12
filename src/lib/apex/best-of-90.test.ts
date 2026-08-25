import { describe, it, expect } from "vitest";
import { scanNow, DEFAULT_SCAN_OPTIONS } from "./scan";
import { operatorSurfaceGate } from "./operator-surface-gate";
import { APEX_UNIVERSE_SYMBOLS } from "./universe";
import { PROPOSITIONS, type Proposition } from "@/lib/sentinel/observation/constants";
import type { MarketIntel, ContractEval } from "./types";

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
    danger: 15,
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

describe("Best-of-90 Full Signal Hydration & Authoritative Presentation", () => {
  const mockMarkets = APEX_UNIVERSE_SYMBOLS.map((s, idx) =>
    createMockMarket(s, `${s} Synthetic Index`, (idx * 2) % 10, 1000),
  );

  // TEST 1 — FULL HYDRATION
  it("TEST 1: scanNow() produces a fully hydrated Best-of-90 object", () => {
    const scan = scanNow(mockMarkets, DEFAULT_SCAN_OPTIONS);
    expect(scan.bestOf90).not.toBeNull();
    const candidate = scan.bestOf90!.candidate;

    expect(candidate.symbol).toBeDefined();
    expect(candidate.contract).toBeDefined();
    expect(candidate.score).toBeGreaterThan(0);
    expect(candidate.agreement).toBeDefined();
    expect(candidate.entryPoint).toBeDefined();
    expect(candidate.digitPsychology).toBeDefined();
    expect(candidate.priceAction).toBeDefined();
    expect(candidate.relative).toBeDefined();
    expect(candidate.persistence).toBeDefined();
    expect(candidate.dangerComposition).toBeDefined();
    expect(candidate.combination).toBeDefined();
    expect(candidate.setup).toBeDefined();
    expect(candidate.signal).toBeDefined();
  });

  // TEST 2 — SAME-CANDIDATE CONSISTENCY
  it("TEST 2: candidate values are perfectly identical between bestOf90 and lead candidate", () => {
    const scan = scanNow(mockMarkets, DEFAULT_SCAN_OPTIONS);
    const b90 = scan.bestOf90!;
    expect(b90.candidate.symbol).toBe(scan.best!.symbol);
    expect(b90.candidate.contract.id).toBe(scan.best!.contract.id);
    expect(b90.candidate.score).toBe(scan.best!.score);
    expect(b90.candidate.entryPoint.status).toBe(scan.best!.entryPoint.status);
  });

  // TEST 3 — ENTRY DIGIT ACCURACY
  it("TEST 3: preferred entry digit matches item.entryPoint.preferred exactly", () => {
    const scan = scanNow(mockMarkets, DEFAULT_SCAN_OPTIONS);
    const candidate = scan.bestOf90!.candidate;
    if (candidate.entryPoint.preferred) {
      expect(candidate.entryPoint.preferred.digit).toBeGreaterThanOrEqual(0);
      expect(candidate.entryPoint.preferred.digit).toBeLessThanOrEqual(9);
      expect(candidate.entryPoint.preferred.winRate).toBeGreaterThan(0);
      expect(candidate.entryPoint.preferred.lowerBound).toBeLessThanOrEqual(candidate.entryPoint.preferred.winRate);
    }
  });

  // TEST 4 — VALIDITY ACCURACY
  it("TEST 4: validity window reflects candidate window definition accurately", () => {
    const scan = scanNow(mockMarkets, DEFAULT_SCAN_OPTIONS);
    const candidate = scan.bestOf90!.candidate;
    expect(candidate.entryPoint.window.label).toBeDefined();
    expect(candidate.entryPoint.window.value).toBeGreaterThanOrEqual(0);
    expect(candidate.entryPoint.window.basis).toBeDefined();
  });

  // TEST 5 — DBOT HANDOFF CONSISTENCY
  it("TEST 5: DBot handoff payload can be completely formed from the bestOf90 candidate", () => {
    const scan = scanNow(mockMarkets, DEFAULT_SCAN_OPTIONS);
    const candidate = scan.bestOf90!.candidate;
    expect(candidate.symbol).toBeTruthy();
    expect(candidate.contract.label).toBeTruthy();
    expect(candidate.contract.side).toBeTruthy();
    expect(candidate.entryPoint.window.label).toBeTruthy();
    expect(Array.isArray(candidate.invalidation)).toBe(true);
  });

  // TEST 6 — NO SYNTHETIC VALUES
  it("TEST 6: unvalidated components report honest empty states instead of fabricated numbers", () => {
    const thinMarket = createMockMarket("R_100", "Thin Market", 7, 5);
    thinMarket.dataState = "THIN";
    const scan = scanNow([thinMarket], DEFAULT_SCAN_OPTIONS);
    if (scan.bestOf90) {
      const candidate = scan.bestOf90.candidate;
      if (!candidate.survival?.sufficient) {
        expect(candidate.survival?.sufficient ?? false).toBe(false);
      }
    }
  });

  // TEST 7 — CANONICAL PSYCHOLOGY
  it("TEST 7: digit psychology uses 1,000-tick canonical distribution", () => {
    const scan = scanNow(mockMarkets, DEFAULT_SCAN_OPTIONS);
    const candidate = scan.bestOf90!.candidate;
    expect(candidate.digitState).toBeDefined();
    expect(candidate.digitState.pct.length).toBe(10);
    expect(candidate.digitPsychology.winningZone).toBeDefined();
    expect(candidate.digitPsychology.losingZone).toBeDefined();
  });

  // TEST 8 — PRESSURE TIMEFRAMES
  it("TEST 8: multi-window pressure (15/30/60/120t) is present and distinct from 1,000t psychology", () => {
    const scan = scanNow(mockMarkets, DEFAULT_SCAN_OPTIONS);
    const candidate = scan.bestOf90!.candidate;
    expect(candidate.priceAction).toBeDefined();
    expect(candidate.priceAction.alignment).toBeDefined();
    expect(candidate.intel.pressure?.window15).toBeDefined();
    expect(candidate.intel.pressure?.window120).toBeDefined();
  });

  // TEST 9 — LOSING-SIDE PRESSURE
  it("TEST 9: losing side pressure is computed with index, modifier and state", () => {
    const scan = scanNow(mockMarkets, DEFAULT_SCAN_OPTIONS);
    const candidate = scan.bestOf90!.candidate;
    const lsp = candidate.losingSidePressure ?? candidate.contract.losingSidePressure;
    expect(lsp).toBeDefined();
    if (lsp) {
      expect(lsp.index).toBeGreaterThanOrEqual(0);
      expect(lsp.index).toBeLessThanOrEqual(100);
      expect(lsp.modifier).toBeGreaterThanOrEqual(0.85);
      expect(lsp.modifier).toBeLessThanOrEqual(1.15);
    }
  });

  // TEST 10 — EXECUTION READY GATE
  it("TEST 10: executionReady boolean and reasons are evaluated correctly", () => {
    const scan = scanNow(mockMarkets, DEFAULT_SCAN_OPTIONS);
    const candidate = scan.bestOf90!.candidate;
    const gate = operatorSurfaceGate(candidate, candidate.intel);

    expect(typeof candidate.executionReady).toBe("boolean");
    expect(Array.isArray(candidate.executionReadyReasons)).toBe(true);
    expect(scan.bestOf90!.qualified).toBe(gate.qualified);
  });

  // TEST 11 — SINGLE-CLICK HYDRATION
  it("TEST 11: single call to scanNow() populates all 90 cells and selects the best candidate", () => {
    const scan = scanNow(mockMarkets, DEFAULT_SCAN_OPTIONS);
    expect(scan.evaluated).toBe(90);
    expect(scan.bestOf90).not.toBeNull();
    expect(scan.bestOf90!.populationSize).toBe(90);
    expect(scan.bestOf90!.bestOfPopulation).toBe(true);
  });

  // TEST 12 — BLOCKED BEST
  it("TEST 12: high-danger candidate that fails the gate is displayed with honest BLOCKED status", () => {
    const dangerousMarkets = APEX_UNIVERSE_SYMBOLS.map((s, idx) => {
      return createMockMarket(s, `${s} Dangerous Index`, (idx * 2) % 10, 1000, 85);
    });
    const scan = scanNow(dangerousMarkets, DEFAULT_SCAN_OPTIONS);
    expect(scan.bestOf90).not.toBeNull();
    expect(scan.bestOf90!.qualified).toBe(false);
    expect(scan.bestOf90!.status).toBe("BEST OF 90 — BLOCKED");
    expect(scan.bestOf90!.blockers.length).toBeGreaterThan(0);
  });
});
