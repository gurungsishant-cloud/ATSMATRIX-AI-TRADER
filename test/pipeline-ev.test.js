/**
 * Test suite for momentum and EV engines
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { MomentumEngine, MomentumDirection } from '../src/pipeline/momentum-engine.js';
import { EvEngine, EvStatus } from '../src/pipeline/ev-engine.js';

// ============================================================================
// MOMENTUM ENGINE TESTS
// ============================================================================

test('MomentumEngine: BULLISH with positive price change', () => {
  const engine = new MomentumEngine();
  const result = engine.calculate({ priceChange24h: 25 }); // 25% gain
  assert.equal(result.status, 'OK');
  assert.equal(result.direction, MomentumDirection.BULLISH);
  assert(result.score > 0.1);
  assert(result.confidence > 0);
});

test('MomentumEngine: BEARISH with negative price change', () => {
  const engine = new MomentumEngine();
  const result = engine.calculate({ priceChange24h: -30 }); // 30% loss
  assert.equal(result.status, 'OK');
  assert.equal(result.direction, MomentumDirection.BEARISH);
  assert(result.score < -0.1);
});

test('MomentumEngine: NEUTRAL with small price change', () => {
  const engine = new MomentumEngine();
  const result = engine.calculate({ priceChange24h: 2 }); // 2% change
  assert.equal(result.status, 'OK');
  assert.equal(result.direction, MomentumDirection.NEUTRAL);
  assert(result.score <= 0.1);
  assert(result.score >= -0.1);
});

test('MomentumEngine: Score clamped to [-1, 1]', () => {
  const engine = new MomentumEngine();
  const result = engine.calculate({ priceChange24h: 500 }); // 500% extreme gain
  assert.equal(result.status, 'OK');
  assert.equal(result.score, 1); // Clamped to 1.0
});

test('MomentumEngine: Score clamped negative at [-1, 1]', () => {
  const engine = new MomentumEngine();
  const result = engine.calculate({ priceChange24h: -500 }); // 500% extreme loss
  assert.equal(result.status, 'OK');
  assert.equal(result.score, -1); // Clamped to -1.0
});

test('MomentumEngine: NO_TRADE with missing price change', () => {
  const engine = new MomentumEngine();
  const result = engine.calculate({});
  assert.equal(result.status, 'NO_TRADE');
  assert.equal(result.reason, 'MISSING_PRICE_CHANGE_DATA');
});

test('MomentumEngine: NO_TRADE with null price change', () => {
  const engine = new MomentumEngine();
  const result = engine.calculate({ priceChange24h: null });
  assert.equal(result.status, 'NO_TRADE');
});

test('MomentumEngine: NO_TRADE with invalid input', () => {
  const engine = new MomentumEngine();
  const result = engine.calculate(null);
  assert.equal(result.status, 'NO_TRADE');
  assert.equal(result.reason, 'INVALID_INPUT');
});

test('MomentumEngine: Confidence increases with magnitude', () => {
  const engine = new MomentumEngine();
  const result5 = engine.calculate({ priceChange24h: 5 });
  const result50 = engine.calculate({ priceChange24h: 50 });
  assert(result50.confidence > result5.confidence);
});

test('MomentumEngine: Uses fixture data provenance', () => {
  const engine = new MomentumEngine();
  const result = engine.calculate({ priceChange24h: 10 });
  assert.equal(result.provenance, 'fixture');
});

// ============================================================================
// EV ENGINE TESTS
// ============================================================================

test('EvEngine: POSITIVE EV when expected gain outweighs loss', () => {
  const engine = new EvEngine();
  const result = engine.calculate({
    winProbability: 0.6, // 60% win rate
    expectedGain: 100,
    expectedLoss: 50,
    fees: 1,
    slippage: 1,
  });
  // EV = (0.6 * 100) - (0.4 * 50) - 1 - 1 = 60 - 20 - 2 = 38
  assert.equal(result.status, EvStatus.POSITIVE);
  assert(result.ev > 0);
  assert.equal(result.recommendation, 'CONSIDER_TRADE');
});

test('EvEngine: ZERO_OR_NEGATIVE EV blocks trading', () => {
  const engine = new EvEngine();
  const result = engine.calculate({
    winProbability: 0.4, // 40% win rate
    expectedGain: 100,
    expectedLoss: 100,
    fees: 10,
    slippage: 5,
  });
  // EV = (0.4 * 100) - (0.6 * 100) - 10 - 5 = 40 - 60 - 15 = -35
  assert.equal(result.status, EvStatus.ZERO_OR_NEGATIVE);
  assert(result.ev <= 0);
  assert.equal(result.recommendation, 'NO_TRADE');
});

test('EvEngine: EV = 0 blocks trading', () => {
  const engine = new EvEngine();
  const result = engine.calculate({
    winProbability: 0.5,
    expectedGain: 100,
    expectedLoss: 100,
    fees: 0,
    slippage: 0,
  });
  // EV = (0.5 * 100) - (0.5 * 100) - 0 - 0 = 0
  assert.equal(result.status, EvStatus.ZERO_OR_NEGATIVE);
  assert.equal(result.ev, 0);
  assert.equal(result.recommendation, 'NO_TRADE');
});

test('EvEngine: NO_TRADE with missing win probability', () => {
  const engine = new EvEngine();
  const result = engine.calculate({
    // winProbability missing
    expectedGain: 100,
    expectedLoss: 50,
    fees: 1,
    slippage: 1,
  });
  assert.equal(result.status, EvStatus.UNKNOWN);
  assert.equal(result.recommendation, 'NO_TRADE');
  assert.equal(result.reason, 'MISSING_WIN_PROBABILITY');
});

test('EvEngine: NO_TRADE with missing expected gain', () => {
  const engine = new EvEngine();
  const result = engine.calculate({
    winProbability: 0.6,
    // expectedGain missing
    expectedLoss: 50,
    fees: 1,
    slippage: 1,
  });
  assert.equal(result.status, EvStatus.UNKNOWN);
  assert.equal(result.recommendation, 'NO_TRADE');
});

test('EvEngine: NO_TRADE with missing expected loss', () => {
  const engine = new EvEngine();
  const result = engine.calculate({
    winProbability: 0.6,
    expectedGain: 100,
    // expectedLoss missing
    fees: 1,
    slippage: 1,
  });
  assert.equal(result.status, EvStatus.UNKNOWN);
  assert.equal(result.recommendation, 'NO_TRADE');
});

test('EvEngine: NO_TRADE with missing fees', () => {
  const engine = new EvEngine();
  const result = engine.calculate({
    winProbability: 0.6,
    expectedGain: 100,
    expectedLoss: 50,
    // fees missing
    slippage: 1,
  });
  assert.equal(result.status, EvStatus.UNKNOWN);
  assert.equal(result.recommendation, 'NO_TRADE');
});

test('EvEngine: NO_TRADE with missing slippage', () => {
  const engine = new EvEngine();
  const result = engine.calculate({
    winProbability: 0.6,
    expectedGain: 100,
    expectedLoss: 50,
    fees: 1,
    // slippage missing
  });
  assert.equal(result.status, EvStatus.UNKNOWN);
  assert.equal(result.recommendation, 'NO_TRADE');
});

test('EvEngine: NO_TRADE with invalid win probability', () => {
  const engine = new EvEngine();
  const result = engine.calculate({
    winProbability: 1.5, // Invalid: > 1
    expectedGain: 100,
    expectedLoss: 50,
    fees: 1,
    slippage: 1,
  });
  assert.equal(result.status, EvStatus.UNKNOWN);
  assert.equal(result.recommendation, 'NO_TRADE');
});

test('EvEngine: NO_TRADE with negative expected gain', () => {
  const engine = new EvEngine();
  const result = engine.calculate({
    winProbability: 0.6,
    expectedGain: -100, // Invalid: negative
    expectedLoss: 50,
    fees: 1,
    slippage: 1,
  });
  assert.equal(result.status, EvStatus.UNKNOWN);
  assert.equal(result.recommendation, 'NO_TRADE');
});

test('EvEngine: Fees reduce EV', () => {
  const engine = new EvEngine();
  const resultNoFees = engine.calculate({
    winProbability: 0.6,
    expectedGain: 100,
    expectedLoss: 50,
    fees: 0,
    slippage: 0,
  });
  const resultWithFees = engine.calculate({
    winProbability: 0.6,
    expectedGain: 100,
    expectedLoss: 50,
    fees: 10,
    slippage: 0,
  });
  assert(resultNoFees.ev > resultWithFees.ev);
});

test('EvEngine: Slippage reduces EV', () => {
  const engine = new EvEngine();
  const resultNoSlippage = engine.calculate({
    winProbability: 0.6,
    expectedGain: 100,
    expectedLoss: 50,
    fees: 0,
    slippage: 0,
  });
  const resultWithSlippage = engine.calculate({
    winProbability: 0.6,
    expectedGain: 100,
    expectedLoss: 50,
    fees: 0,
    slippage: 10,
  });
  assert(resultNoSlippage.ev > resultWithSlippage.ev);
});

test('EvEngine: Returns detailed components', () => {
  const engine = new EvEngine();
  const result = engine.calculate({
    winProbability: 0.6,
    expectedGain: 100,
    expectedLoss: 50,
    fees: 1,
    slippage: 1,
  });
  assert.ok(result.details);
  assert.ok(result.details.gainComponent !== undefined);
  assert.ok(result.details.lossComponent !== undefined);
  assert.ok(result.details.totalCosts !== undefined);
});

test('EvEngine: NO_TRADE with invalid input', () => {
  const engine = new EvEngine();
  const result = engine.calculate(null);
  assert.equal(result.status, EvStatus.UNKNOWN);
  assert.equal(result.recommendation, 'NO_TRADE');
});
