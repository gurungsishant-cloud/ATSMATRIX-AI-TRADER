/**
 * Configuration and environment validation.
 * Fail-closed: all required vars checked at startup.
 */

const validateEnv = () => {
  const env = process.env;
  const config = {
    port: Number(env.PORT || 8787),
    nodeEnv: env.NODE_ENV || 'development',
    realTradingEnabled: env.ATSMATRIX_REAL_TRADING_ENABLED === 'true',
    openaiApiKey: env.OPENAI_API_KEY || null,
  };

  if (config.port < 1 || config.port > 65535) {
    throw new Error('PORT must be between 1 and 65535');
  }

  if (!['development', 'production', 'test'].includes(config.nodeEnv)) {
    throw new Error('NODE_ENV must be development, production, or test');
  }

  if (config.nodeEnv === 'production' && !config.realTradingEnabled) {
    console.warn('[WARN] Real trading disabled in production mode');
  }

  return Object.freeze(config);
};

const config = validateEnv();

export default config;
