/**
 * Test suite for data-quality and risk engines
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { DataQualityEngine, DataQualityStatus } from '../src/pipeline/data-quality.js';
import { RiskEngine, RiskStatus } from '../src/pipeline/risk-engine.js';

// ============================================================================
// DATA QUALITY ENGINE TESTS
// ============================================================================

test('DataQualityEngine: PASS with valid market data', () => {
  const engine = new DataQualityEngine();
  const data = {
    chain: 'solana',
    symbol: 'MEME',
    address: '11111111111111111111111111111111',
    price: 0.001,
    liquidity: 5000,
    timestamp: new Date().toISOString(),
  };
  const result = engine.validate(data);
  assert.equal(result.status, DataQualityStatus.PASS);
});

test('DataQualityEngine: NO_TRADE with missing required field', () => {
  const engine = new DataQualityEngine();
  const data = {
    chain: 'solana',
    symbol: 'MEME',
    address: '11111111111111111111111111111111',
    price: 0.001,
    // liquidity is missing
    timestamp: new Date().toISOString(),
  };
  const result = engine.validate(data);
  assert.equal(result.status, DataQualityStatus.NO_TRADE);
  assert.equal(result.reason, 'MISSING_REQUIRED_FIELDS');
});

test('DataQualityEngine: NO_TRADE with stale data', () => {
  const engine = new DataQualityEngine();
  const staleTime = new Date(Date.now() - 400000).toISOString(); // 6+ minutes ago
  const data = {
    chain: 'solana',
    symbol: 'MEME',
    address: '11111111111111111111111111111111',
    price: 0.001,
    liquidity: 5000,
    timestamp: staleTime,
  };
  const result = engine.validate(data);
  assert.equal(result.status, DataQualityStatus.NO_TRADE);
  assert.equal(result.reason, 'STALE_DATA');
});

test('DataQualityEngine: NO_TRADE with invalid numeric fields', () => {
  const engine = new DataQualityEngine();
  const data = {
    chain: 'solana',
    symbol: 'MEME',
    address: '11111111111111111111111111111111',
    price: -0.001, // negative price is invalid
    liquidity: 5000,
    timestamp: new Date().toISOString(),
  };
  const result = engine.validate(data);
  assert.equal(result.status, DataQualityStatus.NO_TRADE);
  assert.equal(result.reason, 'INVALID_NUMERIC_DATA');
});

test('DataQualityEngine: NO_TRADE with UNKNOWN chain', () => {
  const engine = new DataQualityEngine();
  const data = {
    chain: 'robinhood', // Not verified
    symbol: 'MEME',
    address: '11111111111111111111111111111111',
    price: 0.001,
    liquidity: 5000,
    timestamp: new Date().toISOString(),
  };
  const result = engine.validate(data);
  assert.equal(result.status, DataQualityStatus.NO_TRADE);
  assert.equal(result.reason, 'UNKNOWN_CHAIN');
});

test('DataQualityEngine: NO_TRADE with invalid input', () => {
  const engine = new DataQualityEngine();
  const result = engine.validate(null);
  assert.equal(result.status, DataQualityStatus.NO_TRADE);
  assert.equal(result.reason, 'INVALID_INPUT');
});

// ============================================================================
// RISK ENGINE TESTS
// ============================================================================

test('RiskEngine: PASS with safe token', () => {
  const engine = new RiskEngine();
  const token = {
    liquidity: 10000,
    holders: 100,
    topHolderPercent: 0.1, // 10%
    volume24h: 5000,
    volatility24h: 0.1, // 10%
    honeypot: false,
    isBlacklisted: false,
  };
  const result = engine.assess(token);
  assert.equal(result.status, RiskStatus.PASS);
});

test('RiskEngine: FAIL with insufficient liquidity', () => {
  const engine = new RiskEngine();
  const token = {
    liquidity: 100, // Below $1000 minimum
    holders: 100,
    topHolderPercent: 0.1,
    volume24h: 5000,
    volatility24h: 0.1,
    honeypot: false,
    isBlacklisted: false,
  };
  const result = engine.assess(token);
  assert.equal(result.status, RiskStatus.FAIL);
});

test('RiskEngine: FAIL with high holder concentration', () => {
  const engine = new RiskEngine();
  const token = {
    liquidity: 10000,
    holders: 50,
    topHolderPercent: 0.75, // 75%, exceeds 50% max
    volume24h: 5000,
    volatility24h: 0.1,
    honeypot: false,
    isBlacklisted: false,
  };
  const result = engine.assess(token);
  assert.equal(result.status, RiskStatus.FAIL);
});

test('RiskEngine: FAIL with insufficient volume', () => {
  const engine = new RiskEngine();
  const token = {
    liquidity: 10000,
    holders: 100,
    topHolderPercent: 0.1,
    volume24h: 50, // Below $100 minimum
    volatility24h: 0.1,
    honeypot: false,
    isBlacklisted: false,
  };
  const result = engine.assess(token);
  assert.equal(result.status, RiskStatus.FAIL);
});

test('RiskEngine: FAIL with excessive volatility', () => {
  const engine = new RiskEngine();
  const token = {
    liquidity: 10000,
    holders: 100,
    topHolderPercent: 0.1,
    volume24h: 5000,
    volatility24h: 0.75, // 75%, exceeds 50% max
    honeypot: false,
    isBlacklisted: false,
  };
  const result = engine.assess(token);
  assert.equal(result.status, RiskStatus.FAIL);
});

test('RiskEngine: FAIL with honeypot detected', () => {
  const engine = new RiskEngine();
  const token = {
    liquidity: 10000,
    holders: 100,
    topHolderPercent: 0.1,
    volume24h: 5000,
    volatility24h: 0.1,
    honeypot: true, // Honeypot flag set
    isBlacklisted: false,
  };
  const result = engine.assess(token);
  assert.equal(result.status, RiskStatus.FAIL);
});

test('RiskEngine: FAIL with blacklisted token', () => {
  const engine = new RiskEngine();
  const token = {
    liquidity: 10000,
    holders: 100,
    topHolderPercent: 0.1,
    volume24h: 5000,
    volatility24h: 0.1,
    honeypot: false,
    isBlacklisted: true, // Blacklisted flag set
  };
  const result = engine.assess(token);
  assert.equal(result.status, RiskStatus.FAIL);
});

test('RiskEngine: UNKNOWN with missing liquidity', () => {
  const engine = new RiskEngine();
  const token = {
    // liquidity is missing (UNKNOWN)
    holders: 100,
    topHolderPercent: 0.1,
    volume24h: 5000,
    volatility24h: 0.1,
    honeypot: false,
    isBlacklisted: false,
  };
  const result = engine.assess(token);
  assert.equal(result.status, RiskStatus.UNKNOWN);
});

test('RiskEngine: UNKNOWN with missing holder concentration', () => {
  const engine = new RiskEngine();
  const token = {
    liquidity: 10000,
    holders: 100,
    // topHolderPercent is missing (UNKNOWN)
    volume24h: 5000,
    volatility24h: 0.1,
    honeypot: false,
    isBlacklisted: false,
  };
  const result = engine.assess(token);
  assert.equal(result.status, RiskStatus.UNKNOWN);
});

test('RiskEngine: UNKNOWN takes precedence over FAIL', () => {
  const engine = new RiskEngine();
  const token = {
    // liquidity is missing (UNKNOWN)
    holders: 50,
    topHolderPercent: 0.75, // This would be FAIL
    volume24h: 5000,
    volatility24h: 0.1,
    honeypot: false,
    isBlacklisted: false,
  };
  const result = engine.assess(token);
  // UNKNOWN takes precedence
  assert.equal(result.status, RiskStatus.UNKNOWN);
});

test('RiskEngine: Returns detailed check results', () => {
  const engine = new RiskEngine();
  const token = {
    liquidity: 10000,
    holders: 100,
    topHolderPercent: 0.1,
    volume24h: 5000,
    volatility24h: 0.1,
    honeypot: false,
    isBlacklisted: false,
  };
  const result = engine.assess(token);
  assert.ok(Array.isArray(result.checks));
  assert.ok(result.checks.length >= 6);
  assert.ok(result.summary.pass >= 6);
});

test('RiskEngine: NO_TRADE with invalid token data', () => {
  const engine = new RiskEngine();
  const result = engine.assess(null);
  assert.equal(result.status, RiskStatus.UNKNOWN);
});
