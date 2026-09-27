/**
 * Routes for trading pipeline and AI analysis
 * GET /api/health - Health check
 * POST /api/analyze - Full pipeline + AI analysis
 */

import { TradingPipeline } from '../pipeline/trading-pipeline.js';
import { AuditTrail } from '../pipeline/audit-trail.js';
import { OpenAIAnalyzer } from '../services/openai-analyzer.js';
import { FinalDecision } from '../pipeline/final-risk-gate.js';

const auditTrail = new AuditTrail();

function createPipelineRoutes(app, chainRouter) {
  const pipeline = new TradingPipeline(chainRouter);
  const aiAnalyzer = new OpenAIAnalyzer();

  /**
   * POST /api/analyze
   * Full trading pipeline analysis
   * Input: market data + EV parameters
   * Output: pipeline decision + optional AI advisory
   */
  app.post('/api/analyze', async (req, res) => {
    try {
      const { marketData, evInputs, includeAI } = req.body;

      // Validate input
      if (!marketData || !evInputs) {
        return res.status(400).json({
          error: 'marketData and evInputs are required',
        });
      }

      // Run pipeline
      const pipelineResult = await pipeline.analyze(marketData, evInputs);

      // Record audit event
      const auditEvent = auditTrail.recordDecision(pipelineResult);

      // If includeAI is true and pipeline has data, get AI analysis
      let aiAnalysis = null;
      if (includeAI === true) {
        aiAnalysis = await aiAnalyzer.analyze(pipelineResult);
      }

      // Return combined result
      return res.json({
        pipelineDecision: pipelineResult.finalDecision,
        pipelineReason: pipelineResult.reason,
        stages: pipelineResult.stages,
        aiAdvisory: aiAnalysis,
        auditId: auditEvent.id,
        note: 'AI advisory is for analysis only and does not execute trades. Final decision is made by the pipeline.
      });
    } catch (error) {
      return res.status(500).json({
        error: error.message,
      });
    }
  });

  /**
   * GET /api/audit
   * Retrieve audit events (read-only)
   */
  app.get('/api/audit', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit || 100), 1000);
    const decision = req.query.decision;
    const chain = req.query.chain;

    let events;
    if (decision) {
      events = auditTrail.getEventsByDecision(decision, limit);
    } else if (chain) {
      events = auditTrail.getEventsByChain(chain, limit);
    } else {
      events = auditTrail.getEvents(limit);
    }

    return res.json({ events });
  });
}

export { createPipelineRoutes };
