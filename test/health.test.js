import test from 'node:test';
import assert from 'node:assert/strict';
import { HealthService } from '../src/services/health.js';

test('HealthService returns valid health object', () => {
  const health = new HealthService();
  const status = health.getHealth();

  assert.equal(status.ok, true);
  assert.equal(status.service, 'ATSMATRIX-AI-TRADER');
  assert.equal(status.mode, 'PAPER');
  assert.equal(status.trading.realArmed, false);
  assert.equal(status.trading.realLocked, true);
  assert.equal(status.trading.emergencyStop, false);
});

test('HealthService has correct chain availability', () => {
  const health = new HealthService();
  const status = health.getHealth();

  assert.equal(status.chains.solana.available, true);
  assert.equal(status.chains.ethereum.available, true);
  assert.equal(status.chains.base.available, true);
  assert.equal(status.chains.bsc.available, true);
  assert.equal(status.chains.arbitrum.available, true);
  assert.equal(status.chains.robinhood.available, false);
});

test('HealthService reports real execution as locked by default', () => {
  const health = new HealthService();
  const status = health.getHealth();

  assert.equal(status.execution.realAdapter, 'locked');
});
