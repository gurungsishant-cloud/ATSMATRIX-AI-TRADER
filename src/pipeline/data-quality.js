/**
 * Data Quality Engine
 * Validates market data before trading analysis
 * Missing, stale, or UNKNOWN data => NO_TRADE (fail-closed)
 */

import { DataQualityError } from '../errors.js';

const DataQualityStatus = Object.freeze({
  PASS: 'PASS',
  NO_TRADE: 'NO_TRADE',
});

class DataQualityEngine {
  constructor() {
    this.maxDataAgeSec = 300; // 5 minutes
  }

  /**
   * Validate required fields exist and are not null/undefined/empty
   */
  validateRequired(data, requiredFields) {
    const missing = [];
    requiredFields.forEach(field => {
      if (data[field] === null || data[field] === undefined || data[field] === '') {
        missing.push(field);
      }
    });
    return missing;
  }

  /**
   * Check if numeric value is valid (positive and finite)
   */
  validateNumeric(value, fieldName) {
    if (typeof value !== 'number' || !isFinite(value) || value <= 0) {
      return { valid: false, reason: `${fieldName} must be a positive number` };
    }
    return { valid: true };
  }

  /**
   * Check if data timestamp is not stale
   */
  validateTimestamp(timestamp) {
    if (!timestamp) return { valid: false, reason: 'Timestamp is required' };
    
    const dataTime = new Date(timestamp).getTime();
    const now = Date.now();
    const ageSec = (now - dataTime) / 1000;

    if (ageSec > this.maxDataAgeSec) {
      return { valid: false, reason: `Data is stale: ${ageSec.toFixed(0)}s old (max ${this.maxDataAgeSec}s)` };
    }
    return { valid: true, ageSec };
  }

  /**
   * Main validation flow
   * Returns PASS or NO_TRADE with detailed reason
   */
  validate(marketData) {
    if (!marketData || typeof marketData !== 'object') {
      return {
        status: DataQualityStatus.NO_TRADE,
        reason: 'INVALID_INPUT',
        details: 'Market data is required and must be an object',
      };
    }

    // Required fields for all tokens
    const required = ['chain', 'symbol', 'address', 'price', 'liquidity', 'timestamp'];
    const missing = this.validateRequired(marketData, required);

    if (missing.length > 0) {
      return {
        status: DataQualityStatus.NO_TRADE,
        reason: 'MISSING_REQUIRED_FIELDS',
        details: `Missing: ${missing.join(', ')}`,
      };
    }

    // Validate chain
    const validChains = ['solana', 'ethereum', 'base', 'bsc', 'arbitrum'];
    if (!validChains.includes(marketData.chain?.toLowerCase())) {
      return {
        status: DataQualityStatus.NO_TRADE,
        reason: 'UNKNOWN_CHAIN',
        details: `Chain must be one of: ${validChains.join(', ')}`,
      };
    }

    // Validate numeric fields
    const numericValidation = [
      { value: marketData.price, name: 'price' },
      { value: marketData.liquidity, name: 'liquidity' },
      { value: marketData.volume24h, name: 'volume24h' },
      { value: marketData.holders, name: 'holders' },
    ];

    for (const { value, name } of numericValidation) {
      if (value !== undefined && value !== null) {
        const validation = this.validateNumeric(value, name);
        if (!validation.valid) {
          return {
            status: DataQualityStatus.NO_TRADE,
            reason: 'INVALID_NUMERIC_DATA',
            details: validation.reason,
          };
        }
      }
    }

    // Validate timestamp
    const timestampValidation = this.validateTimestamp(marketData.timestamp);
    if (!timestampValidation.valid) {
      return {
        status: DataQualityStatus.NO_TRADE,
        reason: 'STALE_DATA',
        details: timestampValidation.reason,
      };
    }

    // Validate symbol and address format
    if (!marketData.symbol || typeof marketData.symbol !== 'string' || marketData.symbol.length === 0) {
      return {
        status: DataQualityStatus.NO_TRADE,
        reason: 'INVALID_SYMBOL',
        details: 'Symbol must be a non-empty string',
      };
    }

    if (!marketData.address || typeof marketData.address !== 'string' || marketData.address.length === 0) {
      return {
        status: DataQualityStatus.NO_TRADE,
        reason: 'INVALID_ADDRESS',
        details: 'Address must be a non-empty string',
      };
    }

    // If optional fields are present but invalid, still reject
    if (marketData.slippageBps !== undefined && marketData.slippageBps !== null) {
      const validation = this.validateNumeric(marketData.slippageBps, 'slippageBps');
      if (!validation.valid) {
        return {
          status: DataQualityStatus.NO_TRADE,
          reason: 'INVALID_SLIPPAGE',
          details: validation.reason,
        };
      }
    }

    // All checks passed
    return {
      status: DataQualityStatus.PASS,
      dataAgeSec: timestampValidation.ageSec,
    };
  }
}

export { DataQualityEngine, DataQualityStatus };
