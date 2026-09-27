/**
 * EVM chain adapter (base for Ethereum, Base, BSC, Arbitrum)
 */

import { ChainAdapter } from './chain.adapter.js';

class EvmAdapter extends ChainAdapter {
  constructor(name, chainId, nativeAsset) {
    super(name, 'evm', true);
    this.chainId = chainId;
    this.nativeAsset = nativeAsset;
    this.decimals = 18;
  }

  validate(token) {
    super.validate(token);
    // EVM tokens must be valid 0x addresses
    if (!/^0x[a-fA-F0-9]{40}$/.test(token.address)) {
      throw new Error(`Invalid EVM token address format on ${this.name}`);
    }
  }

  getNetworkStatus() {
    return {
      name: this.name,
      available: true,
      chainId: this.chainId,
      explorer: this.getExplorer(),
    };
  }

  getExplorer() {
    const explorers = {
      ethereum: 'https://etherscan.io',
      base: 'https://basescan.org',
      bsc: 'https://bscscan.com',
      arbitrum: 'https://arbiscan.io',
    };
    return explorers[this.name] || '#';
  }
}

export { EvmAdapter };
