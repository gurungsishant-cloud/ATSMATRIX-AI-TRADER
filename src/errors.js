/**
 * Structured error handling for fail-closed behavior.
 */

class ATSMatrixError extends Error {
  constructor(code, message, statusCode = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.name = 'ATSMatrixError';
  }
}

class ValidationError extends ATSMatrixError {
  constructor(message) {
    super('VALIDATION_ERROR', message, 400);
    this.name = 'ValidationError';
  }
}

class DataQualityError extends ATSMatrixError {
  constructor(message) {
    super('DATA_QUALITY_FAIL_CLOSED', message, 400);
    this.name = 'DataQualityError';
  }
}

class ChainError extends ATSMatrixError {
  constructor(message) {
    super('UNKNOWN_CHAIN', message, 400);
    this.name = 'ChainError';
  }
}

class RealExecutionLockedError extends ATSMatrixError {
  constructor() {
    super('REAL_EXECUTION_LOCKED', 'Real execution is locked by default. ARM manually with POST /api/real/arm', 403);
    this.name = 'RealExecutionLockedError';
  }
}

class SecurityError extends ATSMatrixError {
  constructor(message) {
    super('SECURITY_ERROR', message, 403);
    this.name = 'SecurityError';
  }
}

export { ATSMatrixError, ValidationError, DataQualityError, ChainError, RealExecutionLockedError, SecurityError };
