/**
 * Final Risk Gate
 * Aggregate all upstream checks and make final TRADE/NO_TRADE decision
 * Fail-closed: any FAIL or UNKNOWN blocks trading
 */

const FinalDecision = Object.freeze({
  TRADE: 'TRADE',
  NO_TRADE: 'NO_TRADE',
});

class FinalRiskGate {
  constructor() {
    this.name = 'FinalRiskGate';
  }

  /**
   * Aggregate all pipeline results
   * Only TRADE when ALL checks pass
   * Any FAIL, UNKNOWN, or missing data => NO_TRADE
   */
  decide(pipelineState) {
    if (!pipelineState || typeof pipelineState !== 'object') {
      return {
        decision: FinalDecision.NO_TRADE,
        reason: 'INVALID_PIPELINE_STATE',
        details: 'Pipeline state is required',
      };
    }

    // Check data quality
    if (!pipelineState.dataQuality) {
      return {
        decision: FinalDecision.NO_TRADE,
        reason: 'MISSING_DATA_QUALITY_CHECK',
      };
    }
    if (pipelineState.dataQuality.status !== 'PASS') {
      return {
        decision: FinalDecision.NO_TRADE,
        reason: `DATA_QUALITY_FAILED: ${pipelineState.dataQuality.reason}`,
      };
    }

    // Check risk assessment
    if (!pipelineState.risk) {
      return {
        decision: FinalDecision.NO_TRADE,
        reason: 'MISSING_RISK_CHECK',
      };
    }
    if (pipelineState.risk.status === 'FAIL') {
      return {
        decision: FinalDecision.NO_TRADE,
        reason: 'RISK_GATE_FAILED',
        details: pipelineState.risk.checks,
      };
    }
    if (pipelineState.risk.status === 'UNKNOWN') {
      return {
        decision: FinalDecision.NO_TRADE,
        reason: 'RISK_UNKNOWN',
        details: pipelineState.risk.checks,
      };
    }

    // Check momentum
    if (!pipelineState.momentum) {
      return {
        decision: FinalDecision.NO_TRADE,
        reason: 'MISSING_MOMENTUM_CHECK',
      };
    }
    if (pipelineState.momentum.status !== 'OK') {
      return {
        decision: FinalDecision.NO_TRADE,
        reason: `MOMENTUM_INVALID: ${pipelineState.momentum.status}`,
      };
    }

    // Check EV
    if (!pipelineState.ev) {
      return {
        decision: FinalDecision.NO_TRADE,
        reason: 'MISSING_EV_CHECK',
      };
    }
    if (pipelineState.ev.recommendation !== 'CONSIDER_TRADE') {
      return {
        decision: FinalDecision.NO_TRADE,
        reason: `EV_NEGATIVE_OR_ZERO: EV=${pipelineState.ev.ev}`,
      };
    }
    if (pipelineState.ev.status === 'UNKNOWN') {
      return {
        decision: FinalDecision.NO_TRADE,
        reason: `EV_UNKNOWN: ${pipelineState.ev.reason}`,
      };
    }

    // All checks passed
    return {
      decision: FinalDecision.TRADE,
      reason: 'ALL_CHECKS_PASSED',
      details: {
        dataQuality: pipelineState.dataQuality.status,
        risk: pipelineState.risk.status,
        momentum: pipelineState.momentum.direction,
        ev: pipelineState.ev.ev,
      },
    };
  }
}

export { FinalRiskGate, FinalDecision };
