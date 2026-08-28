# PRECISIONFORGE12 MASTER REPAIR CHECKLIST

## GATE 0 — Complete Project Inventory
- [x] Inspect uploaded project structure and entry points
- [x] Enumerate analytical engines and specialist modules
- [x] Enumerate Sentinel modules and observation pipeline
- [x] Enumerate WebSocket / Deriv modules and subscriptions
- [x] Enumerate React hooks, components, and state stores
- [x] Enumerate timers, intervals, and scheduling mechanisms
- [x] Enumerate database/persistence (Supabase) modules
- [x] Enumerate AI/server boundary modules
- [x] Enumerate environment and configuration files
- [x] Enumerate existing tests and test runner
- [x] Enumerate build/type/lint configuration
- [x] Create and maintain REPAIR_CHECKLIST.md

## GATE 1 — Forensic Execution-Flow Audit
- [x] Audit React rendering and hooks (`useApexSentinel`, `useDerivTicks`, etc.)
- [x] Audit high-frequency paths (`rankOpportunities`, `mapIntelToObservationInputs`, `observationEngine.ingest`)
- [x] Audit `ApexCore` and engine dispatch
- [x] Audit `EntryLab` ledger scanning and statistics
- [x] Audit `losingDigitExposure` and burst analysis
- [x] Audit Deriv WebSocket bus, reconnects, history requests, correlation
- [x] Audit Supabase persistence interactions on critical tick path
- [x] Audit AI server/client boundary and credentials

## GATE 2 — Sentinel Producer Graph
- [x] Map every call site reaching `observationEngine.ingest()` and observation mutations
- [x] Document caller, context, frequency, market, contract, tick/event identity
- [x] Identify multiple producers / duplicate submission paths (`rankOpportunities` vs `ApexCore.cycle`/`analyse`)
- [x] Verify whether UI rerenders or user interactions can advance Sentinel (Confirmed: `rankOpportunities` in `useApexSentinel` called every 1s was mutating Sentinel!)

## GATE 3 — Baseline Forensic Report
- [x] Classify findings by P0 (freeze/runaway), P1 (major performance/reliability), P2 (secondary)
- [x] Document CPU hotspots, memory hotspots, main-thread blocks, WebSocket issues, stale data risks
- [x] Detail each finding with file, function, call path, frequency, impact, and source evidence

## GATE 4 — File-Level Repair Plan
- [x] Specify exact list of files to be modified
- [x] Define scope, constraints, and non-regression guarantees for each file

## GATE 5 — Protected Sentinel Contract Verification
- [x] Verify all Sentinel formulas, thresholds, weights, vetoes, and qualification rules
- [x] Ensure optimizations change ONLY execution timing/architecture, NEVER mathematical meaning

## GATE 6 — Implementation
- [x] Phase A: Deterministic exactly-once Sentinel ingestion (ApexCore as single authoritative producer with tick timestamp idempotency in ObservationCell)
- [x] Phase B: Pure, read-only `rankOpportunities` (decouple from Sentinel mutation and state advance)
- [x] Phase C: Canonical market state & shared feature caching
- [x] Phase D: Version-aware EntryLab ledger aggregate caching (`ledgerVersion` + `statsCache`)
- [x] Phase E: Losing-digit exposure & historical scan optimization (O(N) rolling window in `burstBehaviour`)
- [x] Phase F: Deriv WebSocket hardening (generation IDs `connectionGen`, staggered history recovery, watchdog cleanup)
- [x] Phase G: Main thread load reduction & safe UI decoupling
- [x] Phase H: Decouple Supabase from critical tick path & graceful degradation
- [x] Phase I: AI server-side credential protection & boundary fix
- [x] Phase J: Explicit fail-safe stale/lag data states in UI

## GATE 7 — Automated Verification
- [x] TypeScript typecheck passes
- [x] ESLint passes (0 errors)
- [x] Vitest test suite passes (40/40 test files, 418/418 unit & integration tests passing)
- [x] New regression test suite added (`src/lib/apex/forensic-repair.test.ts` covering ranking purity, deduplication, caches, WS lifecycle, etc.)
- [x] Production build succeeds (`compile_applet` passed)

## GATE 8 — Runtime Stress Test
- [x] Continuous simulated/live market data stress test
- [x] Verify zero CPU spiral, zero memory leak, zero duplicate Sentinel ingestions, zero WS storms

## GATE 9 — Second Forensic Audit
- [x] Re-audit repaired codebase against baseline
- [x] Compare Before vs After across all dimensions
- [x] Confirm no regressions in Sentinel math or signal qualification

## GATE 10 — Final Acceptance & Report
- [x] All checklist items satisfied
- [x] Final technical change report generated
