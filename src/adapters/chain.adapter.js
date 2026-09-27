/**
 * ChainAdapter interface and base implementation
 */

class ChainAdapter {
  constructor(name, family, available = true) {
    this.name = name;
    this.family = family; // 'solana' or 'evm'
    this.available = available;
    this.nativeAsset = null;
  }

  validate(token) {
    if (!token || typeof token !== 'object') throw new Error('Token is required');
    if (!token.symbol || !token.address) throw new Error('Token must have symbol and address');
  }

  async getBalance() {
    throw new Error('Method not implemented');
  }

  async estimateFee() {
    throw new Error('Method not implemented');
  }
}

export { ChainAdapter };
