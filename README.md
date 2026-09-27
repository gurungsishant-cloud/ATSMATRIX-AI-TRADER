# ATSMATRIX // Multi-Chain AI Trading System

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js->=20-green.svg)](https://nodejs.org/)

## Overview

**ATSMATRIX-AI-TRADER** is a production-grade, fail-closed multi-chain memecoin trading orchestration system with:

- **PAPER mode** (enabled by default) — risk-free simulation
- **REAL mode** (locked by default) — requires manual arm with server policy verification
- **Multi-chain support** — Solana, Ethereum, Base, BNB Smart Chain, Arbitrum (Robinhood only with verified RPC)
- **AI risk gates** — momentum, EV, confidence scoring, liquidity checks, slippage limits, daily loss caps
- **Fail-closed execution** — unknown/stale data rejected immediately
- **Full audit trail** — every decision logged and visualized on the graph
- **Isolated real execution** — private keys server-side only; never exposed to frontend
- **Emergency controls** — ARM/DISARM/STOP with comprehensive state management

## Architecture

```
CORE
  ↓
CHAIN ROUTER → [Chain Adapter Selection]
  ↓
CHAIN ADAPTERS
  ├─ Solana Adapter
  ├─ EVM Adapters (Ethereum, Base, BSC, Arbitrum)
  └─ Robinhood (conditional)
  ↓
TOKEN SCANNER → [Market Data Ingestion]
  ↓
DATA QUALITY → [Validation: price, liquidity, staleness]
  ↓
RISK → [Liquidity OK, Slippage OK, Daily Loss OK]
  ↓
MOMENTUM → [Score: -1 to +1]
  ↓
EXPECTED VALUE → [EV Score: 0 to 1]
  ↓
AI ANALYST → [Decision: BUY/SELL/HOLD + Confidence]
  ↓
FINAL RISK GATE → [Aggregate all checks]
  ↓
PAPER / REAL MODE ROUTER
  ├─ PAPER ADAPTER → [Simulated fills]
  └─ REAL ADAPTER → [Actual execution (locked)]
  ↓
EXECUTION LAYER
  ↓
PNL & LEDGER
  ↓
ATSMATRIX TELEMETRY [Audit log, graph visualization]
```

## Quick Start

### Installation

```bash
git clone https://github.com/gurungsishant-cloud/ATSMATRIX-AI-TRADER.git
cd ATSMATRIX-AI-TRADER
npm install
```

### Run Tests

```bash
npm test
```

### Run Linter

```bash
npm run lint
```

### Start PAPER Mode (Development)

```bash
PORT=8787 npm start
# Open http://localhost:8787
```

### Production Build

```bash
npm run build
node dist/server.js
```

## API Endpoints

### Health & State

- `GET /api/health` — Service health, mode (PAPER/REAL), real lock status, chain adapter availability
- `GET /api/state` — Full state: balances, positions, PnL, recent audit log, pipeline graph
- `GET /api/audit?limit=100` — Paginated audit log

### Trading Analysis & Execution

- `POST /api/analyze` — Run full pipeline: scan → risk → decision → execute
  ```json
  {
    "chain": "solana",
    "symbol": "MEME",
    "price": 0.00001234,
    "liquidity": 50000,
    "slippageBps": 50,
    "momentum": 0.7,
    "expectedValue": 0.3,
    "aiDecision": "BUY",
    "confidence": 0.85,
    "quantity": 100000
  }
  ```

- `POST /api/agent-event` — Log an agent event into the graph
  ```json
  {
    "agent": "Scanner-01",
    "event": "token_detected",
    "data": { "symbol": "MEME", "chain": "solana" }
  }
  ```

### Real Mode Control

- `POST /api/real/arm` — Arm real execution (requires `ATSMATRIX_REAL_TRADING_ENABLED=true` server-side)
- `POST /api/real/disarm` — Disarm real execution
- `POST /api/emergency-stop` — Emergency stop (disables real, locks trading)
- `POST /api/emergency-stop/reset` — Reset emergency stop (requires manual verification)

## Dashboard Controls

**Mode Indicator** — Shows PAPER (default) or REAL (if armed)
- REAL is always locked on process start
- REAL lock displayed via "· LOCKED" badge

**Arm / Disarm / Emergency Stop**
- ARM REAL — Attempt to arm real execution; requires server policy verification
- DISARM REAL — Immediately disarm real execution
- EMERGENCY STOP — Kill all execution, clear positions, lock all modes

**Telemetry**
- Balance — Account balance (paper: $10,000 default)
- Positions — Open filled orders
- PnL — Cumulative profit/loss
- Risk Metrics — Liquidity check, slippage check, daily loss check
- Momentum / EV / AI Decision — Decision inputs and final AI signal
- Execution Status — Fills, rejections, and reason codes

**Graph Pipeline Visualization**
- Live node network showing CORE → CHAIN ROUTER → ... → PNL steps
- Color-coded packet flow for each decision
- Agent event nodes auto-added to graph

## Fail-Closed Behavior

All unknown, missing, or stale data **immediately rejects** the order:

```javascript
if (!input || typeof input !== 'object') throw new Error('Input required');
if (!CHAINS[chain]?.enabled) throw new Error('UNKNOWN_CHAIN');
if (input.price == null || input.liquidity == null || input.slippageBps == null) throw new Error('UNKNOWN_DATA_FAIL_CLOSED');
if (Number(input.price) <= 0 || Number(input.liquidity) <= 0) throw new Error('INVALID_MARKET_DATA');
```

## Real Mode Security

**By Design:**
1. REAL mode is **locked by default** on every process restart
2. Server must set `ATSMATRIX_REAL_TRADING_ENABLED=true` (config/secret manager)
3. All chain adapters for REAL must be **verified and reviewed** before deployment
4. Private keys are **never stored in repository** or frontend; use environment variables only
5. ARM endpoint validates server policy before arming
6. Emergency stop immediately disarms and prevents new execution
7. Session IDs tie all audit events for forensic analysis

## Audit Trail

Every event is logged with timestamp, type, and payload:

```json
{
  "id": "evt-1234567890-0",
  "timestamp": "2026-01-15T10:23:45.123Z",
  "type": "SCANNER",
  "chain": "solana",
  "symbol": "MEME",
  "...": "..."
}
```

Audit log endpoints:
- `GET /api/audit?limit=100&offset=0` — Fetch paginated log
- `GET /api/state` — Last 100 events included

## Supported Chains

| Chain | Family | Status | Adapter |
|-------|--------|--------|----------|
| Solana | Native | ✅ Enabled | `SolanaAdapter` |
| Ethereum | EVM | ✅ Enabled | `EvmAdapter` |
| Base | EVM | ✅ Enabled | `EvmAdapter` |
| BNB Smart Chain | EVM | ✅ Enabled | `EvmAdapter` |
| Arbitrum | EVM | ✅ Enabled | `EvmAdapter` |
| Robinhood | EVM | ⚠️ Conditional | `EvmAdapter` (only if `ROBINHOOD_RPC_URL` verified) |

## Development

### File Structure

```
atsmatrix-ai-trader/
├── src/
│   ├── core.js              # Core engine
│   ├── adapters/
│   │   ├── solana.js        # Solana chain adapter
│   │   ├── evm.js           # EVM chain adapters
│   │   ├── paper.js         # Paper execution simulator
│   │   └── real.js          # Real execution (locked)
│   ├── pipeline/
│   │   ├── scanner.js       # Token scanner
│   │   ├── risk.js          # Risk gates
│   │   ├── momentum.js      # Momentum analysis
│   │   ├── ev.js            # Expected value calculator
│   │   └── ai.js            # AI decision maker
│   ├── graph.js             # Agent graph & telemetry
│   └── ledger.js            # PnL & position tracking
├── test/
│   ├── core.test.js
│   ├── adapters.test.js
│   ├── pipeline.test.js
│   ├── security.test.js
│   └── e2e.test.js
├── public/
│   └── index.html           # Dashboard
├── server.js                # HTTP server
├── scripts/
│   ├── build.js
│   └── lint.js
├── package.json
├── .gitignore
├── .env.example
└── README.md
```

### Running Tests

```bash
# All tests
npm test

# Watch mode
npm run test:watch

# Specific test file
node --test test/core.test.js
```

### Linting

```bash
npm run lint
```

Verifies:
- No `console.log()` in production code (use audit log)
- No hardcoded secrets/keys
- No direct `process.env` access outside server.js and adapters
- Proper error handling
- Valid JSON in configs

## Environment Variables

**Never commit `.env` files or private keys to the repository.**

### Development (`.env.local`)

```
PORT=8787
NODE_ENV=development
ATSMATRIX_REAL_TRADING_ENABLED=false
```

### Production (Secret Manager)

```
PORT=8787
NODE_ENV=production
ATSMATRIX_REAL_TRADING_ENABLED=true  (only if verified)
SOLANA_RPC_URL=<secret>
ETHEREUM_RPC_URL=<secret>
... other RPC URLs ...
SOLANA_PRIVATE_KEY=<secret>  (NEVER in repo)
ETHEREUM_PRIVATE_KEY=<secret>  (NEVER in repo)
```

## License

MIT © 2026 ATSMATRIX
