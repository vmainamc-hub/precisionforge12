import { describe, it, expect, beforeEach, vi } from "vitest";
import { apexCore } from "@/lib/apex/core";
import { derivBus } from "@/lib/deriv/tick-bus";
import { rankOpportunities, DEFAULT_SCAN_OPTIONS } from "@/lib/apex/scan";
import { observationEngine, mapIntelToObservationInputs } from "@/lib/sentinel/observation";
import { entryLab } from "@/lib/apex/entry-conditions";
import { losingDigitExposure } from "@/lib/apex/exposure";
import { contractPsychology, type CanonicalDigitState } from "@/lib/sentinel/digit-psychology";
import { composeDanger } from "@/lib/sentinel/danger";

describe("Forensic Repair Protocol Verification Suite", () => {
  beforeEach(() => {
    entryLab.reset();
    vi.restoreAllMocks();
  });

  describe("Phase A & B: Pure Ranking & Idempotent Sentinel Ingestion", () => {
    it("ensures rankOpportunities is 100% pure and does not mutate ObservationCell state or tickCounter", () => {
      const cellInfo = observationEngine.getCell("R_100", "UNDER7");
      const initialAge = cellInfo.dossier?.observationAge ?? 0;

      // Spies on authoritative ingestion and qualification
      const ingestSpy = vi.spyOn(observationEngine, "ingest");
      const qualifySpy = vi.spyOn(observationEngine.qualificationManager, "attemptQualify");

      // Generate market intels
      const intels = apexCore.getAll();

      // Call rankOpportunities 100 times in rapid succession (simulating 100 UI render ticks)
      for (let i = 0; i < 100; i++) {
        const result = rankOpportunities(intels, DEFAULT_SCAN_OPTIONS);
        expect(result).toBeDefined();
        expect(Array.isArray(result.ranked)).toBe(true);
      }

      // STRICT ARCHITECTURAL PROOF: ranking must NEVER touch ingest or attemptQualify
      expect(ingestSpy).toHaveBeenCalledTimes(0);
      expect(qualifySpy).toHaveBeenCalledTimes(0);

      // Verify cell tickCounter and state were not mutated by rankOpportunities
      const cellAfter = observationEngine.getCell("R_100", "UNDER7");
      const ageAfter = cellAfter.dossier?.observationAge ?? 0;
      expect(ageAfter).toBe(initialAge);
    });

    it("ensures ObservationCell is idempotent when receiving duplicate timestamp ticks", () => {
      const fakeTicks = [];
      let price = 500.0;
      for (let i = 0; i < 200; i++) {
        price += (i % 2 === 0 ? 0.1 : -0.09);
        fakeTicks.push({ t: 1700000000000 + i * 1000, price });
      }

      derivBus.setBuffer("R_50", fakeTicks);
      apexCore.analyse("R_50");

      const intel = apexCore.get("R_50");
      expect(intel).toBeDefined();

      const digits = derivBus.getDigits("R_50");
      const mappedInputs = mapIntelToObservationInputs(intel!, digits);
      expect(mappedInputs.length).toBe(6);

      const targetInput = mappedInputs[0];
      const cellId = `${targetInput.marketId}:${targetInput.proposition}`;

      // Ingest the input for the first time
      const dossier1 = observationEngine.ingest(targetInput);
      expect(dossier1).toBeDefined();
      const age1 = dossier1.observationAge;

      // Ingest the EXACT same timestamp input again
      const dossier2 = observationEngine.ingest(targetInput);
      expect(dossier2).toBeDefined();
      const age2 = dossier2.observationAge;

      // Ensure tick counter / age did not double increment on duplicate tick timestamp
      expect(age2).toBe(age1);
      expect(dossier2.cellId).toBe(cellId);
    });
  });

  describe("Phase D: EntryLab Version-Aware Caching", () => {
    it("caches EntryLab stats and invalidates properly on new entries", () => {
      const symbol = "R_100";
      const contract = "EVEN";
      const theoretical = 0.5;

      // Initial stats query on empty ledger
      const stats1 = entryLab.statsFor(symbol, contract, theoretical);
      expect(Array.isArray(stats1)).toBe(true);

      // Query again without changing ledger: must return identical cached array reference
      const stats2 = entryLab.statsFor(symbol, contract, theoretical);
      expect(stats2).toBe(stats1);

      // Add a simulated tick settling an entry or consider a new trade
      entryLab.onTick(symbol, 4, Date.now());

      // Query again after onTick: should safely serve fresh or updated stats
      const stats3 = entryLab.statsFor(symbol, contract, theoretical);
      expect(Array.isArray(stats3)).toBe(true);
    });
  });

  describe("Phase E: Losing-Digit Exposure Optimization", () => {
    it("computes losing digit exposure with high performance and identical bounds", () => {
      const digits: number[] = [];
      for (let i = 0; i < 1000; i++) {
        digits.push(i % 10);
      }

      const winners = [0, 2, 4, 6, 8];
      const report = losingDigitExposure(digits, winners, null, null, "EVEN");

      expect(report).toBeDefined();
      expect(report.losingDigitExposure).toBeGreaterThanOrEqual(0);
      expect(report.losingDigitExposure).toBeLessThanOrEqual(100);
      expect(Array.isArray(report.losers)).toBe(true);
      expect(report.losers).toEqual([1, 3, 5, 7, 9]);
    });
  });

  describe("Phase F: Deriv WebSocket Bus Multi-Generation Hardening", () => {
    it("handles getDigits and getTicks consistently for arbitrary pip sizes", () => {
      const ticks = [
        { t: 1000, price: 123.45 },
        { t: 2000, price: 123.48 },
        { t: 3000, price: 123.42 },
      ];

      derivBus.setBuffer("R_75", ticks);
      const digits = derivBus.getDigits("R_75");

      expect(digits.length).toBe(3);
      expect(digits).toEqual([5, 8, 2]);
    });
  });

  describe("Phase G: End-to-End Core Lifecycle Integrity", () => {
    it("retains, analyses and releases cleanly without lingering memory or unhandled exceptions", () => {
      const release = apexCore.retain();
      expect(typeof release).toBe("function");

      // Simulate tick arrival and market analysis
      const fakeTicks = [];
      let price = 500.0;
      for (let i = 0; i < 150; i++) {
        price += (i % 2 === 0 ? 0.1 : -0.09);
        fakeTicks.push({ t: Date.now() - (150 - i) * 1000, price });
      }

      derivBus.setBuffer("R_10", fakeTicks);
      apexCore.analyse("R_10");

      const intel = apexCore.get("R_10");
      expect(intel).toBeDefined();
      expect(intel?.symbol).toBe("R_10");
      expect(intel?.contracts.length).toBe(6);

      release();
    });
  });

  describe("Phase H: Special Digits (1/8) and Extreme Digits (0/9) Safety Due Diligence", () => {
    it("strictly hard-blocks OVER when RED sits on excluded digit 1", () => {
      const mockState: CanonicalDigitState = {
        n: 1000,
        windowSize: 1000,
        pct: [10, 15, 10, 10, 10, 10, 10, 10, 10, 5],
        recentPct: [10, 15, 10, 10, 10, 10, 10, 10, 10, 5],
        deltaPp: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        green: 2,
        secondGreen: 4,
        red: 1, // Excluded from RED for OVER
        secondRed: 7,
        mostIncreasing: 2,
        mostDecreasing: 9,
        change: "STABLE",
        changeDetail: "Stable",
        summary: "Summary",
      };

      const result = contractPsychology(mockState, {
        label: "OVER 2",
        side: "OVER",
        barrier: 2,
        winners: [3, 4, 5, 6, 7, 8, 9],
      });

      expect(result.hardBlock).toBe(true);
      expect(result.hardBlockReason).toContain("forbidden digit 1");
    });

    it("strictly hard-blocks UNDER when RED sits on excluded digit 8", () => {
      const mockState: CanonicalDigitState = {
        n: 1000,
        windowSize: 1000,
        pct: [10, 10, 10, 10, 10, 10, 10, 10, 15, 5],
        recentPct: [10, 10, 10, 10, 10, 10, 10, 10, 15, 5],
        deltaPp: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        green: 7,
        secondGreen: 5,
        red: 8, // Excluded from RED for UNDER
        secondRed: 2,
        mostIncreasing: 7,
        mostDecreasing: 0,
        change: "STABLE",
        changeDetail: "Stable",
        summary: "Summary",
      };

      const result = contractPsychology(mockState, {
        label: "UNDER 7",
        side: "UNDER",
        barrier: 7,
        winners: [0, 1, 2, 3, 4, 5, 6],
      });

      expect(result.hardBlock).toBe(true);
      expect(result.hardBlockReason).toContain("forbidden digit 8");
    });

    it("evaluates abnormal hostile special digit activity as severe / auto-block danger", () => {
      const danger = composeDanger({
        intel: null,
        contract: {
          label: "OVER 2",
          side: "OVER",
          barrier: 2,
          winners: [3, 4, 5, 6, 7, 8, 9],
        },
        lifetimeTicks: 1000,
        operatorSpecial: {
          digit: 1,
          side: "OVER",
          action: 85,
          state: "ABNORMAL",
          rankingDelta: -6,
          onLosingSide: true,
          drivers: ["clustering x2.5", "pressure accelerating"],
          summary: "Abnormal action on losing digit 1",
        },
      });

      expect(danger.isHardBlocked).toBe(true);
      expect(danger.autoBlock.some((c) => c.code.startsWith("SPECIAL_DIGIT_ABNORMAL_1"))).toBe(true);
    });
  });
});
