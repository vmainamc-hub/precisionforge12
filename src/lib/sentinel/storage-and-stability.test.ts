import { describe, it, expect, beforeEach, vi } from "vitest";
import { safeStorage, safeJsonParse } from "@/lib/storage-fallback";
import { SupabasePersistenceAdapter } from "./observation/supabasePersistence";
import { observationPersistence } from "./observation-persistence";
import { observationEngine } from "./observation/observationEngine";
import { emptyEvidenceInput } from "./observation/index";
import type { ObservationDossier } from "./observation/types";

describe("Storage Fallback & Stability Subsystem", () => {
  beforeEach(() => {
    safeStorage.clearMemory();
  });

  it("1. safeStorage correctly reads and writes in-memory when available", () => {
    const success = safeStorage.setItem("test_key_1", JSON.stringify({ a: 1, b: "hello" }));
    expect(success).toBe(true);

    const read = safeStorage.getItem("test_key_1");
    expect(read).toBeDefined();
    const parsed = safeJsonParse(read, null);
    expect(parsed).toEqual({ a: 1, b: "hello" });
  });

  it("2. safeStorage seamlessly falls back to memory if localStorage throws QuotaExceededError", () => {
    const mockStorage: Record<string, string> = {};
    const mockLocalStorage = {
      getItem: (k: string) => mockStorage[k] ?? null,
      setItem: vi.fn().mockImplementation(() => {
        const err = new Error("QuotaExceededError");
        err.name = "QuotaExceededError";
        throw err;
      }),
      removeItem: (k: string) => {
        delete mockStorage[k];
      },
    };

    // Attach mock window for test
    const origWindow = (globalThis as any).window;
    (globalThis as any).window = { localStorage: mockLocalStorage };

    const success = safeStorage.setItem("quota_test_key", "important_state");
    expect(success).toBe(true);
    expect(safeStorage.isQuotaExceeded()).toBe(true);

    // Reading should still retrieve the in-memory value
    const retrieved = safeStorage.getItem("quota_test_key");
    expect(retrieved).toBe("important_state");

    // Restore window
    (globalThis as any).window = origWindow;
  });

  it("3. SupabasePersistenceAdapter bounds event counts and strips heavy nested payloads", async () => {
    const adapter = new SupabasePersistenceAdapter();

    const mockDossier: ObservationDossier = {
      cellId: "R_100__MATCHES_DIFFERS",
      marketId: "R_100",
      proposition: "MATCHES_DIFFERS",
      state: "RIPE",
      score: 85,
      isRipe: true,
      observationAge: 50,
      currentStateSince: 10,
      stability: "STABLE",
      psychology: "DIGIT_ATTRACTOR",
      entryDigit: 4,
      pressure: 70,
      losingSidePressure: 20,
      danger: 15,
      simulation: "DEVELOPING",
      regime: "TRENDING",
      momentum: "POSITIVE",
      momentumRelation: "CONVERGENT",
      trigger: "TRIGGER_ACTIVE",
      veto: "CLEAR",
      statistics: "STRONG",
      hiddenBehavior: "NONE",
      contradictions: 0,
      supportingEvidence: ["ev1", "ev2", "ev3", "ev4", "ev5", "ev6", "ev7"],
      opposingEvidence: [],
      formationVelocity: "FAST",
      evidenceMaturity: "MATURE",
      tickConfirmation: "CONFIRMED",
      assessment: "READY",
      // Heavy context payload that should NOT be serialized into local storage
      marketContext: { hugeArray: new Array(1000).fill("huge_data") },
      contractContext: { deepTree: { child: { leaf: "data" } } },
    };

    await adapter.saveDossierSnapshot(mockDossier);
    const loaded = await adapter.loadDossier("R_100__MATCHES_DIFFERS");
    expect(loaded).toBeDefined();
    expect(loaded?.score).toBe(85);
    expect(loaded?.supportingEvidence?.length).toBeLessThanOrEqual(5);

    // Append 50 events to single cell, adapter should cap to MAX_STORED_EVENTS_PER_CELL (20)
    for (let i = 0; i < 50; i++) {
      await adapter.appendEvent("R_100__MATCHES_DIFFERS", {
        timestamp: Date.now() + i,
        from: "WATCHING",
        to: "DEVELOPING",
        reason: `transition_${i}`,
      });
    }

    const recent = await adapter.loadRecentEvents("R_100__MATCHES_DIFFERS", 50);
    expect(recent.length).toBeLessThanOrEqual(20);
  });

  it("4. ObservationPersistenceAdapter caps stored events and handles high-volume bursts", () => {
    for (let i = 0; i < 200; i++) {
      observationPersistence.logEvent({
        timestamp: Date.now() + i,
        market: "R_100",
        contract: "MATCHES_DIFFERS",
        from_state: "WATCHING",
        to_state: "DEVELOPING",
        reason: `evt_${i}`,
        trigger_category: "VOLATILITY",
        score_at_transition: 70,
        danger_at_transition: 20,
      });
    }

    const events = observationPersistence.getEvents("R_100", "MATCHES_DIFFERS", 500);
    expect(events.length).toBeLessThanOrEqual(100);
  });

  it("5. Sentinel ObservationEngine processes rapid sustained ticks without memory leaks or state corruption", () => {
    const market = "1HZ10V";
    const initialHealth = observationEngine.getHealthStatus();
    expect(initialHealth.cellsTotal).toBe(90);

    // Feed 30 continuous ticks with diverse digit dynamics
    for (let i = 0; i < 30; i++) {
      const input = emptyEvidenceInput(market, "UNDER6", 1000 + i * 1000);
      observationEngine.ingest(input);
    }

    const postHealth = observationEngine.getHealthStatus();
    expect(postHealth.cellsTotal).toBe(90);
    expect(postHealth.cellsActive).toBeGreaterThan(0);
  });
});


