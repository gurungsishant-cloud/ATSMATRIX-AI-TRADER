/**
 * Test suite for chain adapters and routing
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { SolanaAdapter } from '../src/adapters/solana.adapter.js';
import { EvmAdapter } from '../src/adapters/evm.adapter.js';
import { ChainRouter } from '../src/adapters/chain.router.js';
import { ChainError, ValidationError } from '../src/errors.js';

test('SolanaAdapter initializes with correct properties', () => {
  const adapter = new SolanaAdapter();
  assert.equal(adapter.name, 'solana');
  assert.equal(adapter.family, 'solana');
  assert.equal(adapter.nativeAsset, 'SOL');
  assert.equal(adapter.available, true);
});

test('EvmAdapter initializes correctly for Ethereum', () => {
  const adapter = new EvmAdapter('ethereum', 1, 'ETH');
  assert.equal(adapter.name, 'ethereum');
  assert.equal(adapter.family, 'evm');
  assert.equal(adapter.chainId, 1);
  assert.equal(adapter.nativeAsset, 'ETH');
});

test('SolanaAdapter validates token addresses', () => {
  const adapter = new SolanaAdapter();
  assert.throws(() => adapter.validate({ symbol: 'TEST' }), /address/);
  assert.throws(() => adapter.validate({ symbol: 'TEST', address: 'invalid' }), /Invalid Solana/);
});

test('EvmAdapter validates EVM token addresses', () => {
  const adapter = new EvmAdapter('ethereum', 1, 'ETH');
  assert.throws(() => adapter.validate({ symbol: 'TEST', address: 'invalid' }), /Invalid EVM/);
  // Valid address should not throw
  adapter.validate({ symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' });
});

test('ChainRouter initializes all supported chains', () => {
  const router = new ChainRouter();
  const chains = router.getAllChains();
  assert.equal(chains.solana.available, true);
  assert.equal(chains.ethereum.available, true);
  assert.equal(chains.base.available, true);
  assert.equal(chains.bsc.available, true);
  assert.equal(chains.arbitrum.available, true);
});

test('ChainRouter marks Robinhood as unavailable', () => {
  const router = new ChainRouter();
  const chains = router.getAllChains();
  assert.equal(chains.robinhood.available, false);
  assert.equal(chains.robinhood.reason, 'NETWORK_VERIFICATION_PENDING');
});

test('ChainRouter throws on unknown chain', () => {
  const router = new ChainRouter();
  assert.throws(() => router.getAdapter('unknown-chain'), ChainError);
});

test('ChainRouter throws on unavailable chain', () => {
  const router = new ChainRouter();
  assert.throws(() => router.getAdapter('robinhood'), ChainError);
});

test('ChainRouter manages balances correctly', () => {
  const router = new ChainRouter();
  const initialBalance = router.getBalance('solana');
  assert.equal(initialBalance, 10000);
  router.setBalance('solana', 5000);
  assert.equal(router.getBalance('solana'), 5000);
});
