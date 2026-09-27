/**
 * Momentum Engine
 * Calculate normalized momentum score from market data
 * Uses deterministic calculation; never invents live data
 * Returns: score, direction, confidence, data provenance
 */

const MomentumDirection = Object.freeze({
  BULLISH: 'BULLISH',
  BEARISH: 'BEARISH',
  NEUTRAL: 'NEUTRAL',
  UNKNOWN: 'UNKNOWN',
});

class MomentumEngine {
  constructor() {
    this.dataProvenance = 'fixture'; // Always explicit about data source
  }

  /**
   * Validate required momentum inputs
   * Missing or UNKNOWN data => NO_TRADE
   */
  validateInputs(data) {
    if (!data || typeof data !== 'object') {
      return { valid: false, reason: 'INVALID_INPUT' };
    }

    // At least ONE of these indicators must be present
    const hasAnyIndicator =
      data.priceChange24h !== null &&
      data.priceChange24h !== undefined &&
      data.priceChange24h !== '';

    if (!hasAnyIndicator) {
      return { valid: false, reason: 'MISSING_PRICE_CHANGE_DATA' };
    }

    return { valid: true };
  }

  /**
   * Calculate momentum score from price change
   * Range: -1.0 to +1.0
   * Clamps extreme values to prevent signal distortion
   */
  calculatePriceChangeMomentum(priceChange24h) {
    if (priceChange24h === null || priceChange24h === undefined) {
      return { score: 0, confidence: 0 };
    }

    // Normalize to -1.0 to +1.0 range
    // +100% or more = +1.0
    // -100% or less = -1.0
    // 0% = 0.0
    let score = Math.min(1, Math.max(-1, priceChange24h / 100));

    // Confidence based on magnitude
    // Small changes = low confidence
    // Large changes = high confidence
    const magnitude = Math.abs(priceChange24h);
    const confidence = Math.min(1, magnitude / 50); // 50% change = full confidence

    return { score, confidence };
  }

  /**
   * Determine direction from score
   * BULLISH: score > 0.1
   * BEARISH: score < -0.1
   * NEUTRAL: -0.1 <= score <= 0.1
   */
  determineDirection(score) {
    if (score > 0.1) return MomentumDirection.BULLISH;
    if (score < -0.1) return MomentumDirection.BEARISH;
    return MomentumDirection.NEUTRAL;
  }

  /**
   * Aggregate momentum from available indicators
   */
  calculate(data) {
    const validation = this.validateInputs(data);
    if (!validation.valid) {
      return {
        status: 'NO_TRADE',
        reason: validation.reason,
        score: 0,
        direction: MomentumDirection.UNKNOWN,
        confidence: 0,
        provenance: this.dataProvenance,
      };
    }

    const priceChangeMomentum = this.calculatePriceChangeMomentum(data.priceChange24h);

    // Final score is weighted average of indicators
    const finalScore = priceChangeMomentum.score;
    const finalConfidence = priceChangeMomentum.confidence;
    const direction = this.determineDirection(finalScore);

    return {
      status: 'OK',
      score: finalScore,
      direction,
      confidence: finalConfidence,
      provenance: this.dataProvenance,
      details: {
        priceChange24h: data.priceChange24h,
        priceChangeMomentum,
      },
    };
  }
}

export { MomentumEngine, MomentumDirection };
