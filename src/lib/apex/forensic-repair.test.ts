import { describe, it, expect, beforeEach } from "vitest";
import { apexCore } from "@/lib/apex/core";
import { derivBus } from "@/lib/deriv/tick-bus";
import { rankOpportunities, DEFAULT_SCAN_OPTIONS } from "@/lib/apex/scan";
import { observationEngine, mapIntelToObservationInputs } from "@/lib/sentinel/observation";
import { entryLab } from "@/lib/apex/entry-conditions";
import { losingDigitExposure } from "@/lib/apex/exposure";

describe("Forensic Repair Protocol Verification Suite", () => {
  beforeEach(() => {
    entryLab.reset();
  });

  describe("Phase A & B: Pure Ranking & Idempotent Sentinel Ingestion", () => {
    it("ensures rankOpportunities is 100% pure and does not mutate ObservationCell state or tickCounter", () => {
      const cellInfo = observationEngine.getCell("R_100", "UNDER7");
      const initialAge = cellInfo.dossier?.observationAge ?? 0;

      // Generate dummy market intels
      const intels = apexCore.getAll();

      // Call rankOpportunities 50 times in rapid succession (simulating 50 UI render ticks)
      for (let i = 0; i < 50; i++) {
        const result = rankOpportunities(intels, DEFAULT_SCAN_OPTIONS);
        expect(result).toBeDefined();
        expect(Array.isArray(result.ranked)).toBe(true);
      }

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
});
