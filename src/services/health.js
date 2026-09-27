/**
 * Health service: application status, mode, ARM status, chain availability
 */

import config from '../config.js';

class HealthService {
  constructor() {
    this.realArmed = false;
    this.emergencyStop = false;
    this.startTime = new Date().toISOString();
  }

  getHealth() {
    return {
      ok: true,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - new Date(this.startTime).getTime(),
      service: 'ATSMATRIX-AI-TRADER',
      version: '2.0.0',
      environment: config.nodeEnv,
      mode: this.realArmed ? 'REAL' : 'PAPER',
      trading: {
        realEnabled: config.realTradingEnabled,
        realArmed: this.realArmed,
        realLocked: !this.realArmed || this.emergencyStop,
        emergencyStop: this.emergencyStop,
      },
      chains: {
        solana: { available: true, family: 'native' },
        ethereum: { available: true, family: 'evm' },
        base: { available: true, family: 'evm' },
        bsc: { available: true, family: 'evm' },
        arbitrum: { available: true, family: 'evm' },
        robinhood: { available: false, reason: 'RPC_NOT_VERIFIED' },
      },
      ai: {
        available: config.openaiApiKey ? true : false,
        provider: config.openaiApiKey ? 'openai' : null,
      },
      execution: {
        paperAdapter: 'ready',
        realAdapter: this.realArmed && !this.emergencyStop ? 'armed' : 'locked',
      },
    };
  }
}

export { HealthService };
