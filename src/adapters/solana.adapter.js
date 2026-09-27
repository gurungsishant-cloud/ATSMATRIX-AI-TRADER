/**
 * Solana chain adapter
 */

import { ChainAdapter } from './chain.adapter.js';

class SolanaAdapter extends ChainAdapter {
  constructor() {
    super('solana', 'solana', true);
    this.nativeAsset = 'SOL';
    this.decimals = 9;
    this.minRentExemption = 0.00144;
  }

  validate(token) {
    super.validate(token);
    // Solana tokens are on the SPL token standard
    if (!/^[1-9A-HJ-NP-Z]{32,44}$/.test(token.address)) {
      throw new Error('Invalid Solana token address format');
    }
  }

  getNetworkStatus() {
    return {
      name: 'Solana Mainnet',
      available: true,
      rpc: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
      explorer: 'https://solscan.io',
    };
  }
}

export { SolanaAdapter };
