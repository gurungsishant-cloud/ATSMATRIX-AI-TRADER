/**
 * Test suite for paper execution
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { ChainRouter } from '../src/adapters/chain.router.js';
import { PaperExecutionAdapter } from '../src/adapters/paper.execution.js';
import { DataQualityError, ValidationError } from '../src/errors.js';

test('PaperExecutionAdapter executes BUY order', () => {
  const router = new ChainRouter();
  const executor = new PaperExecutionAdapter(router);

  const result = executor.buy({
    chain: 'solana',
    symbol: 'MEME',
    quantity: 1000,
    price: 0.001,
    slippage: 0.001,
  });

  assert.equal(result.status, 'FILLED');
  assert.equal(result.type, 'BUY');
  assert.equal(result.quantity, 1000);
  assert.equal(result.chain, 'solana');
});

test('PaperExecutionAdapter tracks positions after BUY', () => {
  const router = new ChainRouter();
  const executor = new PaperExecutionAdapter(router);

  executor.buy({
    chain: 'solana',
    symbol: 'MEME',
    quantity: 1000,
    price: 0.001,
  });

  const positions = executor.getPositions('solana');
  assert.equal(positions.length, 1);
  assert.equal(positions[0].symbol, 'MEME');
  assert.equal(positions[0].quantity, 1000);
});

test('PaperExecutionAdapter rejects BUY with insufficient balance', () => {
  const router = new ChainRouter();
  const executor = new PaperExecutionAdapter(router);
  router.setBalance('solana', 1); // Very low balance

  const result = executor.buy({
    chain: 'solana',
    symbol: 'MEME',
    quantity: 1000,
    price: 1,
  });

  assert.equal(result.status, 'REJECTED');
  assert.equal(result.reason, 'INSUFFICIENT_BALANCE');
});

test('PaperExecutionAdapter executes SELL order', () => {
  const router = new ChainRouter();
  const executor = new PaperExecutionAdapter(router);

  executor.buy({
    chain: 'solana',
    symbol: 'MEME',
    quantity: 1000,
    price: 0.001,
  });

  const sellResult = executor.sell({
    chain: 'solana',
    symbol: 'MEME',
    quantity: 500,
    price: 0.002,
  });

  assert.equal(sellResult.status, 'FILLED');
  assert.equal(sellResult.type, 'SELL');
  assert.equal(sellResult.realizedPnL > 0, true); // Profitable trade
});

test('PaperExecutionAdapter rejects SELL with no position', () => {
  const router = new ChainRouter();
  const executor = new PaperExecutionAdapter(router);

  const result = executor.sell({
    chain: 'solana',
    symbol: 'MEME',
    quantity: 100,
    price: 1,
  });

  assert.equal(result.status, 'REJECTED');
  assert.equal(result.reason, 'NO_POSITION');
});

test('PaperExecutionAdapter rejects SELL with insufficient position', () => {
  const router = new ChainRouter();
  const executor = new PaperExecutionAdapter(router);

  executor.buy({
    chain: 'solana',
    symbol: 'MEME',
    quantity: 100,
    price: 0.001,
  });

  const result = executor.sell({
    chain: 'solana',
    symbol: 'MEME',
    quantity: 200,
    price: 0.001,
  });

  assert.equal(result.status, 'REJECTED');
  assert.equal(result.reason, 'INSUFFICIENT_POSITION_SIZE');
});

test('PaperExecutionAdapter calculates PnL correctly', () => {
  const router = new ChainRouter();
  const executor = new PaperExecutionAdapter(router);

  executor.buy({
    chain: 'solana',
    symbol: 'MEME',
    quantity: 1000,
    price: 0.001,
  });

  executor.sell({
    chain: 'solana',
    symbol: 'MEME',
    quantity: 1000,
    price: 0.002,
  });

  const pnl = executor.calculatePnL();
  assert.equal(pnl.realized > 0, true);
});

test('PaperExecutionAdapter fails closed on invalid order', () => {
  const router = new ChainRouter();
  const executor = new PaperExecutionAdapter(router);

  assert.throws(() => executor.buy({}), DataQualityError);
  assert.throws(() => executor.buy({ chain: 'solana', symbol: 'MEME' }), DataQualityError);
});

test('PaperExecutionAdapter maintains trade history', () => {
  const router = new ChainRouter();
  const executor = new PaperExecutionAdapter(router);

  executor.buy({ chain: 'solana', symbol: 'MEME', quantity: 100, price: 0.001 });
  executor.sell({ chain: 'solana', symbol: 'MEME', quantity: 100, price: 0.002 });

  const history = executor.getTradeHistory();
  assert.equal(history.length, 2);
  assert.equal(history[0].type, 'BUY');
  assert.equal(history[1].type, 'SELL');
});
