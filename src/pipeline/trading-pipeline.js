/**
 * Trading Pipeline
 * Orchestrates full analysis: Data Quality → Risk → Momentum → EV → Final Gate → Execution
 * Connects ONLY to PaperExecutionAdapter
 * Never calls RealExecutionAdapter
 */

import { DataQualityEngine } from './data-quality.js';
import { RiskEngine } from './risk-engine.js';
import { MomentumEngine } from './momentum-engine.js';
import { EvEngine } from './ev-engine.js';
import { FinalRiskGate, FinalDecision } from './final-risk-gate.js';
import { PaperExecutionAdapter } from '../adapters/paper.execution.js';

class TradingPipeline {
  constructor(chainRouter) {
    this.chainRouter = chainRouter;
    this.dataQuality = new DataQualityEngine();
    this.risk = new RiskEngine();
    this.momentum = new MomentumEngine();
    this.ev = new EvEngine();
    this.finalGate = new FinalRiskGate();
    this.paper = new PaperExecutionAdapter(chainRouter);
    this.auditLog = []; // Populated by caller with AuditTrail
  }

  /**
   * Run full pipeline on market data + EV inputs
   * Returns: complete decision object with execution result
   */
  async analyze(marketData, evInputs) {
    const decision = {
      timestamp: new Date().toISOString(),
      chain: marketData?.chain,
      symbol: marketData?.symbol,
      address: marketData?.address,
      stages: {},
      finalDecision: null,
      execution: null,
    };

    try {
      // Stage 1: Data Quality
      const dataQualityResult = this.dataQuality.validate(marketData);
      decision.stages.dataQuality = dataQualityResult;

      if (dataQualityResult.status !== 'PASS') {
        decision.finalDecision = FinalDecision.NO_TRADE;
        decision.reason = dataQualityResult.reason;
        return decision;
      }

      // Stage 2: Risk Assessment
      const riskResult = this.risk.assess(marketData);
      decision.stages.risk = riskResult;

      // Stage 3: Momentum Analysis
      const momentumResult = this.momentum.calculate(marketData);
      decision.stages.momentum = momentumResult;

      // Stage 4: EV Calculation
      const evResult = this.ev.calculate(evInputs);
      decision.stages.ev = evResult;

      // Stage 5: Final Risk Gate
      const pipelineState = {
        dataQuality: dataQualityResult,
        risk: riskResult,
        momentum: momentumResult,
        ev: evResult,
      };
      const gateResult = this.finalGate.decide(pipelineState);
      decision.stages.finalGate = gateResult;
      decision.finalDecision = gateResult.decision;
      decision.reason = gateResult.reason;

      // Stage 6: Execution (only if TRADE)
      if (gateResult.decision === FinalDecision.TRADE) {
        try {
          const executionResult = this.paper.buy({
            chain: marketData.chain,
            symbol: marketData.symbol,
            quantity: evInputs.quantity || 100,
            price: marketData.price,
            slippage: marketData.slippageBps ? marketData.slippageBps / 10000 : 0.001,
          });
          decision.execution = executionResult;
        } catch (error) {
          decision.execution = {
            status: 'EXECUTION_ERROR',
            error: error.message,
          };
        }
      }

      return decision;
    } catch (error) {
      decision.finalDecision = FinalDecision.NO_TRADE;
      decision.reason = 'PIPELINE_ERROR';
      decision.error = error.message;
      return decision;
    }
  }
}

export { TradingPipeline };
