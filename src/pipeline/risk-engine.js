/**
 * Risk Engine
 * Comprehensive fail-closed risk assessment
 * Returns PASS / FAIL / UNKNOWN
 * UNKNOWN must block trading
 */

const RiskStatus = Object.freeze({
  PASS: 'PASS',
  FAIL: 'FAIL',
  UNKNOWN: 'UNKNOWN',
});

const RiskThresholds = Object.freeze({
  minLiquidity: 1000, // $1k minimum
  maxHolderConcentration: 0.5, // 50% max concentration
  minVolume24h: 100, // $100 minimum daily volume
  maxVolatility: 0.5, // 50% max volatility
});

class RiskEngine {
  constructor() {
    this.thresholds = { ...RiskThresholds };
  }

  /**
   * Check liquidity sufficiency
   * Returns { pass: boolean, reason: string }
   */
  checkLiquidity(liquidity) {
    if (liquidity === null || liquidity === undefined) {
      return { pass: false, reason: 'UNKNOWN_LIQUIDITY', risk: 'UNKNOWN' };
    }
    if (liquidity < this.thresholds.minLiquidity) {
      return { pass: false, reason: `INSUFFICIENT_LIQUIDITY: $${liquidity} < $${this.thresholds.minLiquidity}`, risk: 'FAIL' };
    }
    return { pass: true, reason: 'Liquidity OK', risk: 'PASS' };
  }

  /**
   * Check holder concentration (rug pull risk)
   * Returns { pass: boolean, reason: string }
   */
  checkHolderConcentration(holders, topHolderPercent) {
    if (holders === null || holders === undefined || holders === 0) {
      return { pass: false, reason: 'UNKNOWN_HOLDERS', risk: 'UNKNOWN' };
    }
    if (topHolderPercent === null || topHolderPercent === undefined) {
      return { pass: false, reason: 'UNKNOWN_TOP_HOLDER_CONCENTRATION', risk: 'UNKNOWN' };
    }
    if (topHolderPercent > this.thresholds.maxHolderConcentration) {
      return { pass: false, reason: `HIGH_CONCENTRATION: top holder has ${(topHolderPercent * 100).toFixed(1)}% (max ${this.thresholds.maxHolderConcentration * 100}%)`, risk: 'FAIL' };
    }
    return { pass: true, reason: 'Holder concentration OK', risk: 'PASS' };
  }

  /**
   * Check trading volume
   * Returns { pass: boolean, reason: string }
   */
  checkVolume(volume24h) {
    if (volume24h === null || volume24h === undefined) {
      return { pass: false, reason: 'UNKNOWN_VOLUME', risk: 'UNKNOWN' };
    }
    if (volume24h < this.thresholds.minVolume24h) {
      return { pass: false, reason: `INSUFFICIENT_VOLUME: $${volume24h} < $${this.thresholds.minVolume24h}`, risk: 'FAIL' };
    }
    return { pass: true, reason: 'Volume OK', risk: 'PASS' };
  }

  /**
   * Check price volatility
   * Returns { pass: boolean, reason: string }
   */
  checkVolatility(volatility24h) {
    if (volatility24h === null || volatility24h === undefined) {
      return { pass: false, reason: 'UNKNOWN_VOLATILITY', risk: 'UNKNOWN' };
    }
    if (volatility24h > this.thresholds.maxVolatility) {
      return { pass: false, reason: `EXCESSIVE_VOLATILITY: ${(volatility24h * 100).toFixed(1)}% > ${this.thresholds.maxVolatility * 100}%`, risk: 'FAIL' };
    }
    return { pass: true, reason: 'Volatility OK', risk: 'PASS' };
  }

  /**
   * Check for suspicious contract indicators
   * Returns { pass: boolean, reason: string }
   */
  checkContractRisk(token) {
    // Fixture check: if token has honeypot flag, it's high risk
    if (token.honeypot === true) {
      return { pass: false, reason: 'HONEYPOT_DETECTED', risk: 'FAIL' };
    }

    // Check for known risk patterns
    if (token.isMintable === true) {
      return { pass: false, reason: 'MINTABLE_TOKEN_HIGH_RISK', risk: 'FAIL' };
    }

    if (token.isBurnable === false && token.supply === undefined) {
      return { pass: false, reason: 'UNKNOWN_SUPPLY_RISK', risk: 'UNKNOWN' };
    }

    return { pass: true, reason: 'Contract risk OK', risk: 'PASS' };
  }

  /**
   * Check for suspicious activity
   * Returns { pass: boolean, reason: string }
   */
  checkSuspiciousActivity(token) {
    if (token.isBlacklisted === true) {
      return { pass: false, reason: 'BLACKLISTED_TOKEN', risk: 'FAIL' };
    }

    if (token.isFresh === true && token.ageSeconds < 60) {
      return { pass: false, reason: 'NEW_TOKEN_HIGH_RISK', risk: 'FAIL' };
    }

    return { pass: true, reason: 'No suspicious activity detected', risk: 'PASS' };
  }

  /**
   * Aggregate all risk checks
   * Returns PASS / FAIL / UNKNOWN
   * If ANY check is UNKNOWN, result is UNKNOWN
   * If ANY check is FAIL and none are UNKNOWN, result is FAIL
   * Only return PASS if all checks pass
   */
  assess(token) {
    if (!token || typeof token !== 'object') {
      return {
        status: RiskStatus.UNKNOWN,
        reason: 'INVALID_TOKEN_DATA',
        checks: [],
      };
    }

    const checks = [
      { name: 'liquidity', result: this.checkLiquidity(token.liquidity) },
      { name: 'holderConcentration', result: this.checkHolderConcentration(token.holders, token.topHolderPercent) },
      { name: 'volume', result: this.checkVolume(token.volume24h) },
      { name: 'volatility', result: this.checkVolatility(token.volatility24h) },
      { name: 'contractRisk', result: this.checkContractRisk(token) },
      { name: 'suspiciousActivity', result: this.checkSuspiciousActivity(token) },
    ];

    // Aggregate results
    let hasUnknown = false;
    let hasFail = false;

    checks.forEach(check => {
      if (check.result.risk === RiskStatus.UNKNOWN) hasUnknown = true;
      if (check.result.risk === RiskStatus.FAIL) hasFail = true;
    });

    let status;
    if (hasUnknown) {
      status = RiskStatus.UNKNOWN;
    } else if (hasFail) {
      status = RiskStatus.FAIL;
    } else {
      status = RiskStatus.PASS;
    }

    return {
      status,
      checks,
      summary: {
        pass: checks.filter(c => c.result.risk === RiskStatus.PASS).length,
        fail: checks.filter(c => c.result.risk === RiskStatus.FAIL).length,
        unknown: checks.filter(c => c.result.risk === RiskStatus.UNKNOWN).length,
      },
    };
  }
}

export { RiskEngine, RiskStatus, RiskThresholds };
