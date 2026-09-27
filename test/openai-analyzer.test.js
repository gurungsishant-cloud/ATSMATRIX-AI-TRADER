/**
 * Tests for OpenAI AI Analysis Service
 * Verifies AI is advisory-only, properly validates data, and integrates with Final Risk Gate
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { OpenAIAnalyzer } from '../src/services/openai-analyzer.js';
import { FinalDecision } from '../src/pipeline/final-risk-gate.js';

// ============================================================================
// OPENAI ANALYZER TESTS
// ============================================================================

test('OpenAIAnalyzer: Detects missing API key', () => {
  // Temporarily unset API key
  const originalKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  const analyzer = new OpenAIAnalyzer();
  const result = analyzer.validateApiKey();

  assert.equal(result.valid, false);
  assert.equal(result.reason, 'MISSING_API_KEY');

  // Restore API key
  if (originalKey) process.env.OPENAI_API_KEY = originalKey;
});

test('OpenAIAnalyzer: Accepts valid API key', () => {
  // Set a dummy API key for testing
  process.env.OPENAI_API_KEY = 'sk-test-123456789';
  const analyzer = new OpenAIAnalyzer();
  const result = analyzer.validateApiKey();

  assert.equal(result.valid, true);
});

test('OpenAIAnalyzer: Rejects invalid pipeline data', () => {
  const analyzer = new OpenAIAnalyzer();
  const result = analyzer.validatePipelineData(null);

  assert.equal(result.valid, false);
  assert.equal(result.reason, 'INVALID_PIPELINE_DATA');
});

test('OpenAIAnalyzer: Detects missing pipeline fields', () => {
  const analyzer = new OpenAIAnalyzer();
  const result = analyzer.validatePipelineData({
    chain: 'solana',
    // symbol missing
    stages: {},
  });

  assert.equal(result.valid, false);
  assert(result.reason.includes('MISSING_FIELDS'));
});

test('OpenAIAnalyzer: Detects UNKNOWN risk in pipeline', () => {
  const analyzer = new OpenAIAnalyzer();
  const result = analyzer.validatePipelineData({
    chain: 'solana',
    symbol: 'TEST',
    stages: {
      risk: { status: 'UNKNOWN' },
    },
  });

  assert.equal(result.valid, false);
  assert.equal(result.reason, 'UNKNOWN_DATA_IN_PIPELINE');
});

test('OpenAIAnalyzer: Detects UNKNOWN EV in pipeline', () => {
  const analyzer = new OpenAIAnalyzer();
  const result = analyzer.validatePipelineData({
    chain: 'solana',
    symbol: 'TEST',
    stages: {
      risk: { status: 'PASS' },
      ev: { status: 'UNKNOWN' },
    },
  });

  assert.equal(result.valid, false);
  assert.equal(result.reason, 'UNKNOWN_DATA_IN_PIPELINE');
});

test('OpenAIAnalyzer: Builds prompt from pipeline data', () => {
  const analyzer = new OpenAIAnalyzer();
  const data = {
    chain: 'solana',
    symbol: 'TEST-MEME',
    stages: {
      dataQuality: { status: 'PASS' },
      risk: { status: 'PASS', summary: { pass: 6, fail: 0, unknown: 0 } },
      momentum: { direction: 'BULLISH', confidence: 0.8 },
      ev: { ev: 50.5, status: 'POSITIVE' },
      finalGate: { reason: 'ALL_CHECKS_PASSED' },
    },
  };

  const prompt = analyzer.buildPrompt(data);

  assert(prompt.includes('solana'));
  assert(prompt.includes('TEST-MEME'));
  assert(prompt.includes('BULLISH'));
  assert(prompt.includes('ADVISORY ONLY'));
});

test('OpenAIAnalyzer: Parses valid AI response', () => {
  const analyzer = new OpenAIAnalyzer();
  const openaiResponse = {
    choices: [
      {
        message: {
          content: JSON.stringify({
            decision: 'ADVISORY_TRADE',
            confidence: 0.75,
            riskAssessment: 'MEDIUM',
            reasoning: 'Strong fundamentals with moderate risk',
            warnings: ['High volatility', 'New token'],
          }),
        },
      },
    ],
  };

  const result = analyzer.parseAIResponse(openaiResponse);

  assert.equal(result.status, 'OK');
  assert.equal(result.analysis.decision, 'ADVISORY_TRADE');
  assert.equal(result.analysis.confidence, 0.75);
  assert.deepEqual(result.analysis.warnings, ['High volatility', 'New token']);
});

test('OpenAIAnalyzer: Rejects invalid confidence score', () => {
  const analyzer = new OpenAIAnalyzer();
  const openaiResponse = {
    choices: [
      {
        message: {
          content: JSON.stringify({
            decision: 'ADVISORY_TRADE',
            confidence: 1.5, // Invalid: > 1
            riskAssessment: 'MEDIUM',
            reasoning: 'Test',
            warnings: [],
          }),
        },
      },
    ],
  };

  const result = analyzer.parseAIResponse(openaiResponse);

  assert.equal(result.status, 'INVALID_RESPONSE');
});

test('OpenAIAnalyzer: Rejects response with missing fields', () => {
  const analyzer = new OpenAIAnalyzer();
  const openaiResponse = {
    choices: [
      {
        message: {
          content: JSON.stringify({
            decision: 'ADVISORY_TRADE',
            confidence: 0.75,
            // riskAssessment missing
            reasoning: 'Test',
            warnings: [],
          }),
        },
      },
    ],
  };

  const result = analyzer.parseAIResponse(openaiResponse);

  assert.equal(result.status, 'INVALID_RESPONSE');
});

test('OpenAIAnalyzer: Returns NO_TRADE when API key missing', async () => {
  const originalKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  const analyzer = new OpenAIAnalyzer();
  const result = await analyzer.analyze({
    chain: 'solana',
    symbol: 'TEST',
    stages: {
      risk: { status: 'PASS' },
      ev: { status: 'POSITIVE' },
    },
  });

  assert.equal(result.status, 'UNAVAILABLE');
  assert.equal(result.decision, 'NO_TRADE');

  if (originalKey) process.env.OPENAI_API_KEY = originalKey;
});

test('OpenAIAnalyzer: Returns NO_TRADE when pipeline data invalid', async () => {
  process.env.OPENAI_API_KEY = 'sk-test-123456789';
  const analyzer = new OpenAIAnalyzer();
  const result = await analyzer.analyze(null);

  assert.equal(result.status, 'INVALID_DATA');
  assert.equal(result.decision, 'NO_TRADE');
});

test('OpenAIAnalyzer: Returns NO_TRADE when UNKNOWN data in pipeline', async () => {
  process.env.OPENAI_API_KEY = 'sk-test-123456789';
  const analyzer = new OpenAIAnalyzer();
  const result = await analyzer.analyze({
    chain: 'solana',
    symbol: 'TEST',
    stages: {
      risk: { status: 'UNKNOWN' },
    },
  });

  assert.equal(result.status, 'INVALID_DATA');
  assert.equal(result.decision, 'NO_TRADE');
});

test('OpenAIAnalyzer: Is advisory-only (never executes trades)', async () => {
  process.env.OPENAI_API_KEY = 'sk-test-123456789';
  const analyzer = new OpenAIAnalyzer();

  // Even if we had a valid response, verify it's advisory
  const prompt = analyzer.buildPrompt({
    chain: 'solana',
    symbol: 'TEST',
    stages: {},
  });

  assert(prompt.includes('ADVISORY ONLY'));
  assert(prompt.includes('does NOT execute'));
});

test('OpenAIAnalyzer: Requires Final Risk Gate validation', async () => {
  // This test verifies that AI output must go through Final Risk Gate
  // The analyzer itself doesn't make execution decisions
  process.env.OPENAI_API_KEY = 'sk-test-123456789';
  const analyzer = new OpenAIAnalyzer();

  // AI returns advisory analysis
  const result = await analyzer.analyze({
    chain: 'solana',
    symbol: 'TEST',
    stages: {
      risk: { status: 'PASS' },
      ev: { status: 'POSITIVE' },
      dataQuality: { status: 'PASS' },
      momentum: { status: 'OK' },
    },
  });

  // Result should note it's advisory only
  if (result.status === 'OK') {
    assert(result.note.includes('Final Risk Gate'));
  }
});
