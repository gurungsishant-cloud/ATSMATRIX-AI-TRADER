/**
 * Audit Trail
 * Records every trading decision and execution for forensic analysis
 */

class AuditTrail {
  constructor() {
    this.events = [];
  }

  /**
   * Record a complete trading decision event
   */
  recordDecision(decision) {
    if (!decision || typeof decision !== 'object') {
      throw new Error('Decision object is required');
    }

    const event = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: decision.timestamp || new Date().toISOString(),
      type: 'TRADING_DECISION',
      chain: decision.chain,
      symbol: decision.symbol,
      address: decision.address,
      stages: {
        dataQuality: decision.stages?.dataQuality?.status,
        risk: decision.stages?.risk?.status,
        momentum: decision.stages?.momentum?.direction,
        ev: decision.stages?.ev?.status,
        finalGate: decision.stages?.finalGate?.reason,
      },
      finalDecision: decision.finalDecision,
      reason: decision.reason,
      execution: decision.execution ? {
        status: decision.execution.status,
        id: decision.execution.id,
      } : null,
    };

    this.events.push(event);
    return event;
  }

  /**
   * Retrieve audit events
   */
  getEvents(limit = 100) {
    return this.events.slice(-limit);
  }

  /**
   * Get events by decision type
   */
  getEventsByDecision(decision, limit = 100) {
    return this.events
      .filter(e => e.finalDecision === decision)
      .slice(-limit);
  }

  /**
   * Get events by chain
   */
  getEventsByChain(chain, limit = 100) {
    return this.events
      .filter(e => e.chain === chain)
      .slice(-limit);
  }

  /**
   * Clear audit log (for testing only)
   */
  clear() {
    this.events = [];
  }
}

export { AuditTrail };
