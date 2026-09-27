/**
 * Real execution adapter: intentionally locked
 */

import { RealExecutionLockedError, SecurityError } from '../errors.js';

class RealExecutionAdapter {
  constructor() {
    this.locked = true;
    this.name = 'real-execution';
  }

  validateSafety(config) {
    if (!config.realTradingEnabled) {
      throw new SecurityError('Real trading is not enabled on this server');
    }
    if (!config.realArmed) {
      throw new RealExecutionLockedError();
    }
    if (config.emergencyStop) {
      throw new SecurityError('Emergency stop is active. Real execution is locked.');
    }
  }

  buy(order, config) {
    this.validateSafety(config);
    throw new SecurityError('Real execution adapter not yet implemented. Only paper trading is available.');
  }

  sell(order, config) {
    this.validateSafety(config);
    throw new SecurityError('Real execution adapter not yet implemented. Only paper trading is available.');
  }
}

export { RealExecutionAdapter };
