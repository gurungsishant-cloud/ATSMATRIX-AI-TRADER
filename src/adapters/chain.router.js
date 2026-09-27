/**
 * Chain router: maintains chain registry and routes to appropriate adapters
 */

import { SolanaAdapter } from './solana.adapter.js';
import { EvmAdapter } from './evm.adapter.js';
import { ChainError, ValidationError } from '../errors.js';

class ChainRouter {
  constructor() {
    this.chains = new Map();
    this.balances = new Map();
    this.initializeChains();
  }

  initializeChains() {
    // Solana
    const solana = new SolanaAdapter();
    this.chains.set('solana', solana);
    this.balances.set('solana', 10000); // $10k paper balance

    // Ethereum
    const ethereum = new EvmAdapter('ethereum', 1, 'ETH');
    this.chains.set('ethereum', ethereum);
    this.balances.set('ethereum', 5); // 5 ETH paper balance

    // Base
    const base = new EvmAdapter('base', 8453, 'ETH');
    this.chains.set('base', base);
    this.balances.set('base', 50); // 50 ETH paper balance

    // BNB Smart Chain
    const bsc = new EvmAdapter('bsc', 56, 'BNB');
    this.chains.set('bsc', bsc);
    this.balances.set('bsc', 10); // 10 BNB paper balance

    // Arbitrum
    const arbitrum = new EvmAdapter('arbitrum', 42161, 'ETH');
    this.chains.set('arbitrum', arbitrum);
    this.balances.set('arbitrum', 30); // 30 ETH paper balance

    // Robinhood: intentionally unavailable (no verified RPC/network details)
    const robinhoodUnavailable = {
      name: 'robinhood',
      available: false,
      reason: 'NETWORK_VERIFICATION_PENDING',
      family: 'evm',
      message: 'Robinhood Chain adapter requires verified network configuration',
    };
    this.chains.set('robinhood', robinhoodUnavailable);
  }

  getAdapter(chainName) {
    if (!chainName || typeof chainName !== 'string') {
      throw new ValidationError('Chain name is required');
    }

    const chain = this.chains.get(chainName.toLowerCase());
    if (!chain) {
      throw new ChainError(`Unknown chain: ${chainName}`);
    }

    if (!chain.available) {
      throw new ChainError(`Chain unavailable: ${chain.message || chain.reason}`);
    }

    return chain;
  }

  getChainStatus(chainName) {
    const chain = this.chains.get(chainName?.toLowerCase());
    if (!chain) return { available: false, reason: 'UNKNOWN_CHAIN' };
    if (!chain.available) return { available: false, reason: chain.reason };
    return chain.getNetworkStatus();
  }

  getBalance(chainName) {
    this.getAdapter(chainName); // Validate chain exists
    return this.balances.get(chainName.toLowerCase()) || 0;
  }

  setBalance(chainName, balance) {
    this.getAdapter(chainName);
    this.balances.set(chainName.toLowerCase(), balance);
  }

  getAllChains() {
    const result = {};
    for (const [name, chain] of this.chains) {
      if (chain.available) {
        result[name] = {
          available: true,
          name: chain.name,
          family: chain.family,
          nativeAsset: chain.nativeAsset,
          balance: this.balances.get(name),
        };
      } else {
        result[name] = {
          available: false,
          reason: chain.reason,
          message: chain.message,
        };
      }
    }
    return result;
  }
}

export { ChainRouter };
