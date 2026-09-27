/**
 * Expected Value (EV) Engine
 * Calculate expected value from probability, gain, loss, fees, and slippage
 * Missing inputs or EV <= 0 => NO_TRADE (fail-closed)
 * Returns: ev, winProbability, expectedGain, expectedLoss, recommendation
 */

const EvStatus = Object.freeze({
  POSITIVE: 'POSITIVE',
  ZERO_OR_NEGATIVE: 'ZERO_OR_NEGATIVE',
  UNKNOWN: 'UNKNOWN',
});

class EvEngine {
  constructor() {
    this.minWinProbability = 0.0; // Can be any value [0, 1]
    this.minExpectedGain = 0.001; // Minimum expected gain to consider
  }

  /**
   * Validate required EV inputs
   * Missing or UNKNOWN data => NO_TRADE
   */
  validateInputs(data) {
    if (!data || typeof data !== 'object') {
      return { valid: false, reason: 'INVALID_INPUT' };
    }

    // Required fields
    if (data.winProbability === null || data.winProbability === undefined) {
      return { valid: false, reason: 'MISSING_WIN_PROBABILITY' };
    }
    if (data.expectedGain === null || data.expectedGain === undefined) {
      return { valid: false, reason: 'MISSING_EXPECTED_GAIN' };
    }
    if (data.expectedLoss === null || data.expectedLoss === undefined) {
      return { valid: false, reason: 'MISSING_EXPECTED_LOSS' };
    }
    if (data.fees === null || data.fees === undefined) {
      return { valid: false, reason: 'MISSING_FEES' };
    }
    if (data.slippage === null || data.slippage === undefined) {
      return { valid: false, reason: 'MISSING_SLIPPAGE' };
    }

    // Validate ranges
    if (typeof data.winProbability !== 'number' || data.winProbability < 0 || data.winProbability > 1) {
      return { valid: false, reason: 'INVALID_WIN_PROBABILITY: must be between 0 and 1' };
    }
    if (typeof data.expectedGain !== 'number' || data.expectedGain < 0) {
      return { valid: false, reason: 'INVALID_EXPECTED_GAIN: must be >= 0' };
    }
    if (typeof data.expectedLoss !== 'number' || data.expectedLoss < 0) {
      return { valid: false, reason: 'INVALID_EXPECTED_LOSS: must be >= 0' };
    }
    if (typeof data.fees !== 'number' || data.fees < 0) {
      return { valid: false, reason: 'INVALID_FEES: must be >= 0' };
    }
    if (typeof data.slippage !== 'number' || data.slippage < 0) {
      return { valid: false, reason: 'INVALID_SLIPPAGE: must be >= 0' };
    }

    return { valid: true };
  }

  /**
   * Calculate expected value
   * EV = (winProbability * expectedGain) - ((1 - winProbability) * expectedLoss) - fees - slippage
   */
  calculate(data) {
    const validation = this.validateInputs(data);
    if (!validation.valid) {
      return {
        status: EvStatus.UNKNOWN,
        reason: validation.reason,
        ev: 0,
        recommendation: 'NO_TRADE',
      };
    }

    const { winProbability, expectedGain, expectedLoss, fees, slippage } = data;

    // EV formula: (P_win * Gain) - (P_loss * Loss) - Fees - Slippage
    const lossProbability = 1 - winProbability;
    const ev = winProbability * expectedGain - lossProbability * expectedLoss - fees - slippage;

    // Determine status and recommendation
    let status, recommendation;
    if (ev > 0) {
      status = EvStatus.POSITIVE;
      recommendation = 'CONSIDER_TRADE';
    } else if (ev === 0) {
      status = EvStatus.ZERO_OR_NEGATIVE;
      recommendation = 'NO_TRADE';
    } else {
      status = EvStatus.ZERO_OR_NEGATIVE;
      recommendation = 'NO_TRADE';
    }

    return {
      status,
      ev,
      winProbability,
      lossProbability,
      expectedGain,
      expectedLoss,
      fees,
      slippage,
      recommendation,
      details: {
        gainComponent: winProbability * expectedGain,
        lossComponent: lossProbability * expectedLoss,
        totalCosts: fees + slippage,
      },
    };
  }
}

export { EvEngine, EvStatus };
