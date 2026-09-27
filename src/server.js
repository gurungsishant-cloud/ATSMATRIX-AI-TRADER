/**
 * ATSMATRIX AI Trading System - Backend Foundation
 * Multi-chain, fail-closed, paper-first trading engine
 */

import http from 'node:http';
import { logger } from './logger.js';
import config from './config.js';
import { createRouter } from './routes.js';
import { HealthService } from './services/health.js';

const healthService = new HealthService();
const router = createRouter(healthService);

const server = http.createServer(async (req, res) => {
  try {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    // JSON response helper
    const json = (statusCode, body) => {
      res.writeHead(statusCode, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(body));
    };

    // Parse body
    const parseBody = () =>
      new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
          if (body.length > 1e6) reject(new Error('Payload too large'));
        });
        req.on('end', () => {
          try {
            resolve(body ? JSON.parse(body) : {});
          } catch (e) {
            reject(new Error('Invalid JSON'));
          }
        });
        req.on('error', reject);
      });

    const route = req.url.split('?')[0];

    // Route handling
    if (req.method === 'GET' && route === '/api/health') {
      const health = healthService.getHealth();
      return json(200, health);
    }

    if (req.method === 'GET' && route === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end('<html><body><h1>ATSMATRIX AI Trader</h1><p>Backend running. Dashboard coming next.</p></body></html>');
    }

    // 404
    json(404, { error: 'NOT_FOUND', code: 'ROUTE_NOT_FOUND' });
  } catch (error) {
    logger.error('Server error', { message: error.message, code: error.code });
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'INTERNAL_SERVER_ERROR', code: error.code || 'UNKNOWN' }));
  }
});

const port = config.port;
server.listen(port, () => {
  logger.info(`ATSMATRIX listening on http://localhost:${port}`);
  logger.info(`Mode: ${config.nodeEnv}`);
  logger.info(`Real Trading Enabled: ${config.realTradingEnabled}`);
  logger.info(`OpenAI Available: ${config.openaiApiKey ? 'yes' : 'no'}`);
});

server.on('error', error => {
  logger.error('Server error', { message: error.message, code: error.code });
  process.exit(1);
});

export { server };
