/**
 * Integration tests for full trading pipeline
 * Tests the complete flow: Data Quality → Risk → Momentum → EV → Final Gate → Paper Execution
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { ChainRouter } from '../src/adapters/chain.router.js';
import { TradingPipeline } from '../src/pipeline/trading-pipeline.js';
import { AuditTrail } from '../src/pipeline/audit-trail.js';
import { FinalDecision } from '../src/pipeline/final-risk-gate.js';

// ============================================================================
// FIXTURE DATA (clearly labeled as fixture)
// ============================================================================

const createFixtureToken = (overrides = {}) => ({
  chain: 'solana',
  symbol: 'TEST-MEME',
  address: '11111111111111111111111111111111',
  price: 0.001,
  liquidity: 10000,
  volume24h: 5000,
  volatility24h: 0.1,
  holders: 100,
  topHolderPercent: 0.1,
  priceChange24h: 15,
  timestamp: new Date().toISOString(),
  slippageBps: 100,
  honeypot: false,
  isBlacklisted: false,
  ...overrides,
});

const createFixtureEV = (overrides = {}) => ({
  winProbability: 0.6,
  expectedGain: 100,
  expectedLoss: 50,
  fees: 1,
  slippage: 1,
  quantity: 100,
  ...overrides,
});

// ============================================================================
// FULL PIPELINE TESTS
// ============================================================================

test('TradingPipeline: Full flow with all checks PASS => TRADE + execution', async () => {
  const router = new ChainRouter();
  const pipeline = new TradingPipeline(router);
  const audit = new AuditTrail();

  const token = createFixtureToken();
  const ev = createFixtureEV();

  const result = await pipeline.analyze(token, ev);

  assert.equal(result.finalDecision, FinalDecision.TRADE);
  assert.equal(result.stages.dataQuality.status, 'PASS');
  assert.equal(result.stages.risk.status, 'PASS');
  assert.equal(result.stages.momentum.status, 'OK');
  assert.equal(result.stages.ev.status, 'POSITIVE');
  assert.ok(result.execution);
  assert.equal(result.execution.status, 'FILLED');

  // Record audit event
  const auditEvent = audit.recordDecision(result);
  assert.equal(auditEvent.finalDecision, FinalDecision.TRADE);
});

test('TradingPipeline: Risk FAIL => NO_TRADE', async () => {
  const router = new ChainRouter();
  const pipeline = new TradingPipeline(router);

  const token = createFixtureToken({
    liquidity: 100, // Below minimum
  });
  const ev = createFixtureEV();

  const result = await pipeline.analyze(token, ev);

  assert.equal(result.finalDecision, FinalDecision.NO_TRADE);
  assert.equal(result.reason, 'RISK_GATE_FAILED');
  assert.equal(result.execution, null);
});

test('TradingPipeline: Risk UNKNOWN => NO_TRADE', async () => {
  const router = new ChainRouter();
  const pipeline = new TradingPipeline(router);

  const token = createFixtureToken({
    holders: undefined, // Unknown holder count
  });
  const ev = createFixtureEV();

  const result = await pipeline.analyze(token, ev);

  assert.equal(result.finalDecision, FinalDecision.NO_TRADE);
  assert.equal(result.reason, 'RISK_UNKNOWN');
  assert.equal(result.execution, null);
});

test('TradingPipeline: Bad data => NO_TRADE', async () => {
  const router = new ChainRouter();
  const pipeline = new TradingPipeline(router);

  const token = {
    chain: 'solana',
    // Missing required fields
  };
  const ev = createFixtureEV();

  const result = await pipeline.analyze(token, ev);

  assert.equal(result.finalDecision, FinalDecision.NO_TRADE);
  assert(result.reason.includes('MISSING'));
  assert.equal(result.execution, null);
});

test('TradingPipeline: EV <= 0 => NO_TRADE', async () => {
  const router = new ChainRouter();
  const pipeline = new TradingPipeline(router);

  const token = createFixtureToken();
  const ev = createFixtureEV({
    winProbability: 0.3, // Low probability => negative EV
  });

  const result = await pipeline.analyze(token, ev);

  assert.equal(result.finalDecision, FinalDecision.NO_TRADE);
  assert(result.reason.includes('EV'));
  assert.equal(result.execution, null);
});

test('TradingPipeline: Paper execution receives TRADE decision', async () => {
  const router = new ChainRouter();
  const pipeline = new TradingPipeline(router);

  const token = createFixtureToken();
  const ev = createFixtureEV();

  const result = await pipeline.analyze(token, ev);

  assert.equal(result.finalDecision, FinalDecision.TRADE);
  assert.ok(result.execution);
  assert.equal(result.execution.status, 'FILLED');
  assert.equal(result.execution.type, 'BUY');
});

test('TradingPipeline: NO_TRADE creates no execution', async () => {
  const router = new ChainRouter();
  const pipeline = new TradingPipeline(router);

  const token = createFixtureToken({
    liquidity: 50, // Below minimum
  });
  const ev = createFixtureEV();

  const result = await pipeline.analyze(token, ev);

  assert.equal(result.finalDecision, FinalDecision.NO_TRADE);
  assert.equal(result.execution, null);
});

test('TradingPipeline: Audit trail records all decisions', async () => {
  const router = new ChainRouter();
  const pipeline = new TradingPipeline(router);
  const audit = new AuditTrail();

  const token = createFixtureToken();
  const ev = createFixtureEV();

  const result = await pipeline.analyze(token, ev);
  const auditEvent = audit.recordDecision(result);

  assert.equal(auditEvent.chain, 'solana');
  assert.equal(auditEvent.symbol, 'TEST-MEME');
  assert.equal(auditEvent.finalDecision, FinalDecision.TRADE);
  assert.ok(auditEvent.id);
  assert.ok(auditEvent.timestamp);
});

test('AuditTrail: Records NO_TRADE decisions', async () => {
  const router = new ChainRouter();
  const pipeline = new TradingPipeline(router);
  const audit = new AuditTrail();

  const token = createFixtureToken({
    liquidity: 50,
  });
  const ev = createFixtureEV();

  const result = await pipeline.analyze(token, ev);
  const auditEvent = audit.recordDecision(result);

  assert.equal(auditEvent.finalDecision, FinalDecision.NO_TRADE);
  assert.ok(auditEvent.reason);
});

test('AuditTrail: Retrieves events with limit', () => {
  const audit = new AuditTrail();

  for (let i = 0; i < 10; i++) {
    audit.recordDecision({
      timestamp: new Date().toISOString(),
      chain: 'solana',
      symbol: `TEST-${i}`,
      address: '11111111111111111111111111111111',
      stages: { dataQuality: { status: 'PASS' }, risk: { status: 'PASS' }, momentum: { status: 'OK' }, ev: { status: 'POSITIVE' } },
      finalDecision: FinalDecision.TRADE,
      reason: 'ALL_CHECKS_PASSED',
    });
  }

  const events = audit.getEvents(5);
  assert.equal(events.length, 5);
});

test('AuditTrail: Filters by decision', () => {
  const audit = new AuditTrail();

  audit.recordDecision({
    timestamp: new Date().toISOString(),
    chain: 'solana',
    symbol: 'TEST-1',
    finalDecision: FinalDecision.TRADE,
  });

  audit.recordDecision({
    timestamp: new Date().toISOString(),
    chain: 'solana',
    symbol: 'TEST-2',
    finalDecision: FinalDecision.NO_TRADE,
  });

  const trades = audit.getEventsByDecision(FinalDecision.TRADE);
  const noTrades = audit.getEventsByDecision(FinalDecision.NO_TRADE);

  assert.equal(trades.length, 1);
  assert.equal(noTrades.length, 1);
});

test('AuditTrail: Filters by chain', () => {
  const audit = new AuditTrail();

  audit.recordDecision({
    timestamp: new Date().toISOString(),
    chain: 'solana',
    symbol: 'TEST',
    finalDecision: FinalDecision.TRADE,
  });

  audit.recordDecision({
    timestamp: new Date().toISOString(),
    chain: 'ethereum',
    symbol: 'TEST',
    finalDecision: FinalDecision.TRADE,
  });

  const solanaEvents = audit.getEventsByChain('solana');
  assert.equal(solanaEvents.length, 1);
  assert.equal(solanaEvents[0].chain, 'solana');
});

test('TradingPipeline: Momentum NEUTRAL does not block TRADE', async () => {
  const router = new ChainRouter();
  const pipeline = new TradingPipeline(router);

  const token = createFixtureToken({
    priceChange24h: 1, // Neutral momentum
  });
  const ev = createFixtureEV();

  const result = await pipeline.analyze(token, ev);

  // Neutral momentum doesn't prevent trade if EV is positive
  assert.equal(result.finalDecision, FinalDecision.TRADE);
  assert.equal(result.stages.momentum.direction, 'NEUTRAL');
});

test('TradingPipeline: Stale data => NO_TRADE', async () => {
  const router = new ChainRouter();
  const pipeline = new TradingPipeline(router);

  const staleTime = new Date(Date.now() - 400000).toISOString();
  const token = createFixtureToken({
    timestamp: staleTime, // Very old data
  });
  const ev = createFixtureEV();

  const result = await pipeline.analyze(token, ev);

  assert.equal(result.finalDecision, FinalDecision.NO_TRADE);
  assert.equal(result.stages.dataQuality.status, 'NO_TRADE');
});
