/**
 * Paper execution adapter: simulated trading without real transactions
 */

import { ValidationError, DataQualityError } from '../errors.js';

class PaperExecutionAdapter {
  constructor(chainRouter) {
    this.chainRouter = chainRouter;
    this.positions = new Map(); // chainName:symbol -> position
    this.tradeHistory = [];
    this.fees = 0.001; // 0.1% fee
  }

  validateOrder(order) {
    if (!order || typeof order !== 'object') throw new ValidationError('Order is required');
    if (!order.chain || !order.symbol || !order.quantity || !order.price) {
      throw new DataQualityError('Order missing required fields: chain, symbol, quantity, price');
    }
    if (Number(order.quantity) <= 0 || Number(order.price) <= 0) {
      throw new DataQualityError('Quantity and price must be positive');
    }
    if (!['BUY', 'SELL'].includes(order.type)) {
      throw new ValidationError('Order type must be BUY or SELL');
    }
  }

  buy(order) {
    this.validateOrder({ ...order, type: 'BUY' });

    const chain = this.chainRouter.getAdapter(order.chain);
    const balance = this.chainRouter.getBalance(order.chain);

    const quantity = Number(order.quantity);
    const price = Number(order.price);
    const slippage = Number(order.slippage || 0.001); // default 0.1%
    const slippedPrice = price * (1 + slippage);
    const totalCost = quantity * slippedPrice;
    const fees = totalCost * this.fees;
    const totalWithFees = totalCost + fees;

    if (totalWithFees > balance) {
      return {
        status: 'REJECTED',
        reason: 'INSUFFICIENT_BALANCE',
        required: totalWithFees,
        available: balance,
      };
    }

    const positionKey = `${order.chain}:${order.symbol}`;
    const position = this.positions.get(positionKey) || { quantity: 0, entryPrice: 0 };

    const newQuantity = position.quantity + quantity;
    const newEntryPrice = (position.entryPrice * position.quantity + slippedPrice * quantity) / newQuantity;

    this.positions.set(positionKey, {
      quantity: newQuantity,
      entryPrice: newEntryPrice,
      chain: order.chain,
      symbol: order.symbol,
      entries: [...(position.entries || []), { quantity, price: slippedPrice, timestamp: new Date().toISOString() }],
    });

    const newBalance = balance - totalWithFees;
    this.chainRouter.setBalance(order.chain, newBalance);

    const trade = {
      id: `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'BUY',
      timestamp: new Date().toISOString(),
      chain: order.chain,
      symbol: order.symbol,
      quantity,
      price,
      slippage,
      slippedPrice,
      totalCost,
      fees,
      totalWithFees,
      balanceBefore: balance,
      balanceAfter: newBalance,
      status: 'FILLED',
    };

    this.tradeHistory.push(trade);
    return trade;
  }

  sell(order) {
    this.validateOrder({ ...order, type: 'SELL' });

    const positionKey = `${order.chain}:${order.symbol}`;
    const position = this.positions.get(positionKey);

    if (!position || position.quantity === 0) {
      return {
        status: 'REJECTED',
        reason: 'NO_POSITION',
        positionKey,
      };
    }

    const quantity = Number(order.quantity);
    if (quantity > position.quantity) {
      return {
        status: 'REJECTED',
        reason: 'INSUFFICIENT_POSITION_SIZE',
        available: position.quantity,
        requested: quantity,
      };
    }

    const balance = this.chainRouter.getBalance(order.chain);
    const price = Number(order.price);
    const slippage = Number(order.slippage || 0.001);
    const slippedPrice = price * (1 - slippage); // slippage hurts seller
    const totalProceeds = quantity * slippedPrice;
    const fees = totalProceeds * this.fees;
    const netProceeds = totalProceeds - fees;

    // Calculate realized PnL
    const costBasis = position.entryPrice * quantity;
    const realizedPnL = netProceeds - costBasis;

    const newQuantity = position.quantity - quantity;
    if (newQuantity === 0) {
      this.positions.delete(positionKey);
    } else {
      this.positions.set(positionKey, {
        ...position,
        quantity: newQuantity,
      });
    }

    const newBalance = balance + netProceeds;
    this.chainRouter.setBalance(order.chain, newBalance);

    const trade = {
      id: `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'SELL',
      timestamp: new Date().toISOString(),
      chain: order.chain,
      symbol: order.symbol,
      quantity,
      price,
      slippage,
      slippedPrice,
      totalProceeds,
      fees,
      netProceeds,
      costBasis,
      realizedPnL,
      balanceBefore: balance,
      balanceAfter: newBalance,
      status: 'FILLED',
    };

    this.tradeHistory.push(trade);
    return trade;
  }

  getPositions(chainName = null) {
    if (!chainName) {
      return Array.from(this.positions.values());
    }
    return Array.from(this.positions.values()).filter(p => p.chain === chainName);
  }

  getTradeHistory(limit = 100) {
    return this.tradeHistory.slice(-limit);
  }

  calculatePnL() {
    let realizedPnL = 0;
    let unrealizedPnL = 0;

    // Realized PnL from trades
    this.tradeHistory.forEach(trade => {
      if (trade.type === 'SELL' && trade.realizedPnL) {
        realizedPnL += trade.realizedPnL;
      }
    });

    // Unrealized PnL from open positions (assumes current price = last entry price)
    this.positions.forEach(position => {
      // For paper trading, we assume mark price = entry price for unrealized
      unrealizedPnL += position.quantity * position.entryPrice;
    });

    return {
      realized: realizedPnL,
      unrealized: unrealizedPnL,
      total: realizedPnL + unrealizedPnL,
    };
  }

  reset() {
    this.positions.clear();
    this.tradeHistory = [];
  }
}

export { PaperExecutionAdapter };
