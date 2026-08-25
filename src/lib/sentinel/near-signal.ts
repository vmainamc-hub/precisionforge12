/**
 * SENTINEL — NEAR-SIGNAL DIAGNOSTIC ENGINE.
 *
 * Distinguishes ordinary weak/rejected candidates from high-conviction
 * candidates that possess strong, coherent evidence across the Sentinel stack
 * but are missing only a narrow, execution-specific condition (e.g. entry trigger touch,
 * validity window timing).
 *
 * CRITICAL CONTRACT:
 * - NEAR-SIGNAL is strictly diagnostic.
 * - isExecutable is ALWAYS false.
 * - It NEVER bypasses Operator Surface Gate, executionReady, Stage 4, or Veto.
 * - It NEVER promotes a weak setup.
 */

import type { RankedOpportunity } from "../apex/types";
import type { SetupFactor } from "@/types/sentinel";

export interface NearSignalAssessment {
  isNearSignal: boolean;
  verdict: "NEAR_SIGNAL" | "NOT_NEAR_SIGNAL" | "EXECUTABLE";
  isExecutable: false;
  strengths: string[];
  missingConditions: string[];
  factors: SetupFactor[];
  summary: string;
}

export class NearSignalEngine {
  /**
   * Evaluates whether a RankedOpportunity qualifies as a diagnostic NEAR-SIGNAL.
   */
  public static evaluate(candidate: RankedOpportunity): NearSignalAssessment {
    const strengths: string[] = [];
    const missingConditions: string[] = [];
    const factors: SetupFactor[] = [];

    // Check if the candidate is already fully executable and cleared
    const isStage4Cleared = candidate.finalDecision?.verdict === "CLEARED";
    const isExecutionReady = Boolean(candidate.executionReady);
    const isGateQualified = Boolean(
      candidate.clearance?.state === "CLEARED" &&
      !candidate.blocked &&
      candidate.score >= 70 &&
      (candidate.dangerComposition?.total ?? candidate.contract.danger ?? 0) <= 45
    );

    if (isStage4Cleared && isExecutionReady && isGateQualified) {
      return {
        isNearSignal: false,
        verdict: "EXECUTABLE",
        isExecutable: false, // Diagnostic engine never issues execution authority
        strengths: ["All mandatory execution conditions and Stage 4 risk gates satisfied."],
        missingConditions: [],
        factors: [],
        summary: "Candidate is fully executable under current live conditions.",
      };
    }

    // 1. EVALUATE HARD DISQUALIFIERS (Any hard disqualifier immediately rules out NEAR-SIGNAL)
    const danger = candidate.dangerComposition?.total ?? candidate.contract.danger ?? 0;
    const isHardDanger = danger > 45;
    const isVetoed = Boolean(
      candidate.blocked ||
      candidate.clearance?.state === "BLOCKED" ||
      candidate.vetoResolution?.hasVeto ||
      candidate.governance?.allowTrade === false
    );
    const sampleSize = candidate.contract.n || candidate.intel?.ticks || 0;
    const isThinSample = sampleSize < 60;
    const hasMajorContradictions = (candidate.contract.contradiction ?? 0) > 2 || (candidate.contract.conflicts?.length ?? 0) > 2;
    const isBrokenDirection = candidate.direction?.state === "OPPOSED" || candidate.direction?.broken === true;
    const isHostileRegime = candidate.contract.regimeCompatible === false;
    const isCircuitBreakerTripped = candidate.finalDecision?.circuitBreaker?.tripped === true;

    if (isHardDanger) {
      missingConditions.push(`Danger ${danger}/100 exceeds maximum safety ceiling (45)`);
    }
    if (isVetoed) {
      missingConditions.push("Active hard veto in place");
    }
    if (isThinSample) {
      missingConditions.push(`Sample size (${sampleSize}) below minimum required observations (60)`);
    }
    if (hasMajorContradictions) {
      missingConditions.push(`High contradiction level (${candidate.contract.contradiction})`);
    }
    if (isBrokenDirection) {
      missingConditions.push("Structural directional spine is broken or opposed");
    }
    if (isHostileRegime) {
      missingConditions.push("Market regime incompatible with contract structure");
    }
    if (isCircuitBreakerTripped) {
      missingConditions.push("Session circuit breaker is tripped");
    }

    // If any hard disqualifier exists, it is NOT a Near-Signal
    if (
      isHardDanger ||
      isVetoed ||
      isThinSample ||
      hasMajorContradictions ||
      isBrokenDirection ||
      isHostileRegime ||
      isCircuitBreakerTripped
    ) {
      return {
        isNearSignal: false,
        verdict: "NOT_NEAR_SIGNAL",
        isExecutable: false,
        strengths: [],
        missingConditions,
        factors: [],
        summary: `Disqualified from Near-Signal: ${missingConditions[0]}`,
      };
    }

    // 2. EVALUATE POSITIVE EVIDENCE CONVICTION
    let positiveCount = 0;

    // A. Structural Direction Alignment
    const directionSide = candidate.direction?.direction ?? candidate.intel?.pressure?.bias;
    const contractSide = candidate.contract.side;
    if (directionSide === contractSide) {
      positiveCount++;
      strengths.push(`Direction: ${contractSide} supported by 1,000-tick spine`);
      factors.push({
        code: "NS_DIRECTION",
        label: "Directional Spine Alignment",
        points: 20,
        measuredValue: contractSide,
        detail: "1,000-tick structural trend aligned with contract side.",
      });
    }

    // B. Digit Psychology Alignment
    const psych = candidate.digitPsychology;
    const psychScore = psych?.supportScore ?? 0;
    const psychDominance = psych?.winningSideDominance ?? false;
    const hasGreenBar = Boolean(candidate.intel?.bars?.green && candidate.contract.winners.includes(candidate.intel.bars.green));
    if (psychScore >= 60 || psychDominance || hasGreenBar) {
      positiveCount++;
      strengths.push(`Digit Psychology: Strong winning zone structure (${psychScore > 0 ? psychScore : 65}/100)`);
      factors.push({
        code: "NS_PSYCHOLOGY",
        label: "Digit Psychology",
        points: 25,
        measuredValue: `${psychScore}/100`,
        detail: "Digit frequency and winning zone momentum strongly favorable.",
      });
    }

    // C. Lower-Timeframe Pressure
    const confirmsStructure = candidate.priceAction?.confirmsStructure !== false;
    const noPressureThreat = candidate.priceAction?.losingSidePressure?.state !== "ACTIVE_THREAT";
    if (confirmsStructure && noPressureThreat) {
      positiveCount++;
      strengths.push("Pressure: Lower-timeframe (120-tick) pressure confirms structure");
      factors.push({
        code: "NS_PRESSURE",
        label: "Pressure Confirmation",
        points: 20,
        measuredValue: "CONFIRMED",
        detail: "120-tick pressure confirms 1,000-tick structure without losing side threat.",
      });
    }

    // D. Cross-Engine Agreement & Confidence
    const agreement = candidate.agreement;
    const confidence = candidate.evidence?.confidence ?? candidate.contract.confidence ?? 0;
    if ((agreement === "SUPPORT" || agreement === "NEUTRAL") && confidence >= 60) {
      positiveCount++;
      strengths.push(`Engine Agreement: ${agreement} (Confidence: ${confidence.toFixed(0)}%)`);
      factors.push({
        code: "NS_AGREEMENT",
        label: "Engine Confluence",
        points: 20,
        measuredValue: `${confidence}%`,
        detail: `High multi-engine agreement (${agreement}) and statistical confidence.`,
      });
    }

    // E. Acceptable Danger Floor
    if (danger <= 38) {
      positiveCount++;
      strengths.push(`Danger: ${danger}/100 (Well within safety limit)`);
      factors.push({
        code: "NS_SAFETY",
        label: "Danger Ceiling",
        points: 15,
        measuredValue: `${danger}/100`,
        detail: "Low anomaly, volatility, and digit risk profile.",
      });
    }

    // 3. IDENTIFY SPECIFIC NARROW EXECUTION GAP
    if (candidate.entryPoint?.status === "WAIT") {
      missingConditions.push("Entry trigger touch not yet confirmed on preferred digit");
    }
    if (candidate.signal?.state === "VALID_WAIT_ENTRY") {
      missingConditions.push("Awaiting valid entry timing window");
    }
    if (candidate.entryClearance?.verdict === "WAIT") {
      missingConditions.push("Stage 3 entry clearance awaiting primary trigger sequence");
    }
    if (!candidate.executionReady && candidate.executionReadyReasons?.length) {
      candidate.executionReadyReasons.forEach((r) => {
        if (!missingConditions.includes(r)) missingConditions.push(r);
      });
    }

    // NEAR-SIGNAL requires at least 3 strong positive evidence points AND at least one identified narrow gap
    const isNearSignal = positiveCount >= 3 && missingConditions.length > 0;

    if (isNearSignal) {
      return {
        isNearSignal: true,
        verdict: "NEAR_SIGNAL",
        isExecutable: false, // Diagnostic only - never executable
        strengths,
        missingConditions,
        factors,
        summary: `NEAR SIGNAL: Strong evidence across ${positiveCount} engines; awaiting ${missingConditions[0]}.`,
      };
    }

    return {
      isNearSignal: false,
      verdict: "NOT_NEAR_SIGNAL",
      isExecutable: false,
      strengths,
      missingConditions: missingConditions.length > 0 ? missingConditions : ["Insufficient positive evidence conviction across engines."],
      factors,
      summary: "Candidate lacks sufficient multi-engine strength to qualify as Near-Signal.",
    };
  }
}
