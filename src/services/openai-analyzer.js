/**
 * OpenAI AI Analysis Service
 * Advisory-only analysis layer
 * Never executes trades; output must pass through Final Risk Gate
 */

import https from 'https';

class OpenAIAnalyzer {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    this.model = 'gpt-4o-mini';
    this.baseUrl = 'https://api.openai.com/v1';
  }

  /**
   * Validate that API key exists and is non-empty
   */
  validateApiKey() {
    if (!this.apiKey || typeof this.apiKey !== 'string' || this.apiKey.trim() === '') {
      return { valid: false, reason: 'MISSING_API_KEY' };
    }
    return { valid: true };
  }

  /**
   * Validate pipeline data before sending to AI
   */
  validatePipelineData(data) {
    if (!data || typeof data !== 'object') {
      return { valid: false, reason: 'INVALID_PIPELINE_DATA' };
    }

    const requiredFields = ['chain', 'symbol', 'stages'];
    const missing = requiredFields.filter(f => !data[f]);
    if (missing.length > 0) {
      return { valid: false, reason: `MISSING_FIELDS: ${missing.join(', ')}` };
    }

    // Check for UNKNOWN data
    if (data.stages.risk?.status === 'UNKNOWN' ||
        data.stages.ev?.status === 'UNKNOWN' ||
        data.stages.momentum?.status === 'UNKNOWN') {
      return { valid: false, reason: 'UNKNOWN_DATA_IN_PIPELINE' };
    }

    return { valid: true };
  }

  /**
   * Build prompt for AI analysis
   */
  buildPrompt(data) {
    return `You are a cryptocurrency trading risk analyst. Analyze this token trading opportunity and provide structured JSON output.

Token Data:
- Chain: ${data.chain}
- Symbol: ${data.symbol}
- Price: $${data.stages.dataQuality?.dataAgeSec ? 'from recent data' : 'unknown'}

Pipeline Analysis Results:
- Data Quality: ${data.stages.dataQuality?.status}
- Risk Assessment: ${data.stages.risk?.status}
  - Summary: ${data.stages.risk?.summary ? `${data.stages.risk.summary.pass} passed, ${data.stages.risk.summary.fail} failed, ${data.stages.risk.summary.unknown} unknown` : 'N/A'}
- Momentum: ${data.stages.momentum?.direction || 'UNKNOWN'} (confidence: ${data.stages.momentum?.confidence || 0})
- Expected Value: ${data.stages.ev?.ev?.toFixed(2) || 'unknown'}
- Final Gate Recommendation: ${data.stages.finalGate?.reason || 'unknown'}

Provide your analysis in this exact JSON format:
{
  "decision": "ADVISORY_TRADE" | "ADVISORY_NO_TRADE",
  "confidence": 0.0-1.0,
  "riskAssessment": "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN",
  "reasoning": "explanation of decision",
  "warnings": ["warning1", "warning2"]
}

IMPORTANT: Your decision is ADVISORY ONLY. It does NOT execute any trades. The final execution gate will make the actual decision.`;
  }

  /**
   * Make request to OpenAI API
   */
  async makeOpenAIRequest(prompt) {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify({
        model: this.model,
        messages: [
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 500,
      });

      const options = {
        hostname: 'api.openai.com',
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'Authorization': `Bearer ${this.apiKey}`,
        },
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode !== 200) {
            return reject(new Error(`OpenAI API error: ${res.statusCode} ${data}`));
          }

          try {
            const response = JSON.parse(data);
            resolve(response);
          } catch (error) {
            reject(new Error(`Failed to parse OpenAI response: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`OpenAI API request failed: ${error.message}`));
      });

      req.write(payload);
      req.end();
    });
  }

  /**
   * Parse AI response and extract structured analysis
   */
  parseAIResponse(openaiResponse) {
    try {
      if (!openaiResponse.choices || !openaiResponse.choices[0] || !openaiResponse.choices[0].message) {
        throw new Error('Invalid OpenAI response structure');
      }

      const content = openaiResponse.choices[0].message.content;
      const analysis = JSON.parse(content);

      // Validate required fields
      const required = ['decision', 'confidence', 'riskAssessment', 'reasoning', 'warnings'];
      const missing = required.filter(f => analysis[f] === undefined);
      if (missing.length > 0) {
        throw new Error(`Missing required fields in AI response: ${missing.join(', ')}`);
      }

      // Validate confidence is a number between 0 and 1
      if (typeof analysis.confidence !== 'number' || analysis.confidence < 0 || analysis.confidence > 1) {
        throw new Error('Confidence must be a number between 0 and 1');
      }

      return {
        status: 'OK',
        analysis,
      };
    } catch (error) {
      return {
        status: 'INVALID_RESPONSE',
        reason: error.message,
      };
    }
  }

  /**
   * Main analysis endpoint
   * Takes pipeline data and returns AI analysis
   * Never executes trades; output must pass through Final Risk Gate
   */
  async analyze(pipelineData) {
    // Validate API key
    const keyValidation = this.validateApiKey();
    if (!keyValidation.valid) {
      return {
        status: 'UNAVAILABLE',
        reason: keyValidation.reason,
        decision: 'NO_TRADE',
      };
    }

    // Validate pipeline data
    const dataValidation = this.validatePipelineData(pipelineData);
    if (!dataValidation.valid) {
      return {
        status: 'INVALID_DATA',
        reason: dataValidation.reason,
        decision: 'NO_TRADE',
      };
    }

    try {
      // Build and send prompt to OpenAI
      const prompt = this.buildPrompt(pipelineData);
      const openaiResponse = await this.makeOpenAIRequest(prompt);

      // Parse response
      const parseResult = this.parseAIResponse(openaiResponse);
      if (parseResult.status !== 'OK') {
        return {
          status: 'INVALID_RESPONSE',
          reason: parseResult.reason,
          decision: 'NO_TRADE',
        };
      }

      // Return analysis (ADVISORY ONLY)
      return {
        status: 'OK',
        aiAnalysis: parseResult.analysis,
        note: 'ADVISORY ONLY - must pass through Final Risk Gate for execution',
      };
    } catch (error) {
      return {
        status: 'API_ERROR',
        reason: error.message,
        decision: 'NO_TRADE',
      };
    }
  }
}

export { OpenAIAnalyzer };
