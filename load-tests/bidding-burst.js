/**
 * @fileoverview k6 Load Test Script for High-Frequency Bidding & WebSocket Streaming.
 *
 * ARCHITECTURAL ROLE:
 * This script serves as the "Judge" of Phase 6. It mathematically validates that 
 * the platform remains stable under high-concurrency bidding wars (100+ VUs).
 */

import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

// Custom metrics to track auction-specific performance
const successfulBids = new Counter('auction_bids_accepted');
const rejectedBids = new Counter('auction_bids_rejected');
const bidLatency = new Trend('auction_bid_latency');

/**
 * k6 Configuration Options
 */
export const options = {
  stages: [
    { duration: '10s', target: 50 },  // Ramp up to 50 users
    { duration: '20s', target: 100 }, // Peak bidding war: 100 users
    { duration: '10s', target: 0 },   // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'], // 95% of requests must be under 200ms
    auction_bids_accepted: ['count > 0'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000/api';
const WS_URL = __ENV.WS_URL || 'ws://localhost:3000/auction';

/**
 * 0. Setup Phase: Ensure at least one product exists for the bidding war.
 * This runs ONCE before any VUs are started.
 */
export function setup() {
  const productsRes = http.get(`${BASE_URL}/products`);
  const products = productsRes.json();

  if (Array.isArray(products) && products.length > 0) {
    console.log(`Found ${products.length} existing products. Using first one for test.`);
    return { itemId: products[0].id };
  }

  console.log('No products found in database. Seeding a test product...');
  const payload = JSON.stringify({
    name: 'CI/CD Load Test Product',
    description: 'Auto-seeded for performance validation',
    current_price: 100,
  });

  const params = {
    headers: { 'Content-Type': 'application/json' },
  };

  const seedRes = http.post(`${BASE_URL}/products`, payload, params);

  if (seedRes.status !== 201 && seedRes.status !== 200) {
    throw new Error(`CRITICAL: Failed to seed product. Status=${seedRes.status} Body=${seedRes.body}`);
  }

  const seededProduct = seedRes.json();
  console.log(`Successfully seeded product ID: ${seededProduct.id}`);
  return { itemId: seededProduct.id };
}

/**
 * Main Virtual User (VU) behavior.
 * Each VU simulates a bidder placing high-frequency bids.
 */
export default function (data) {
  const userId = `vu-user-${(__VU + 1).toString().padStart(3, '0')}`;
  const ITEM_ID = data.itemId;

  // 1. Fetch current state to determine valid bid
  const stateRes = http.get(`${BASE_URL}/auction/${ITEM_ID}/state`);
  const hasState = check(stateRes, { 'status is 200': (r) => r.status === 200 });

  if (hasState) {
    const product = stateRes.json();
    const currentPrice = parseFloat(product.current_price);
    const bidAmount = currentPrice + Math.floor(Math.random() * 50) + 1;

    // 2. Attempt to place a bid (Concurrency & Atomicity Test)
    const payload = JSON.stringify({
      item_id: ITEM_ID,
      user_id: userId,
      amount: bidAmount,
    });

    const params = {
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': `${userId}-${bidAmount}`,
      },
    };

    const startTime = Date.now();
    const bidRes = http.post(`${BASE_URL}/bids/place-bid`, payload, params);
    bidLatency.add(Date.now() - startTime);

    // 3. Analyze Results
    if (bidRes.status !== 200 && bidRes.status !== 400) {
      console.log(`Bid Failed: Status=${bidRes.status} Body=${bidRes.body}`);
    }

    check(bidRes, {
      'bid handled (200 or 400)': (r) => r.status === 200 || r.status === 400,
    });

    if (bidRes.status === 200) {
      successfulBids.add(1);
    } else if (bidRes.status === 400) {
      rejectedBids.add(1);
    }
  }

  // Sleep small random amount to simulate human/network jitter
  sleep(Math.random() * 0.5 + 0.1);
}

/**
 * WebSocket Subscriber behavior.
 */
export function websocket_test() {
  ws.connect(WS_URL, null, function (socket) {
    socket.on('open', () => console.log('WebSocket connected: Listening for stream...'));
    socket.on('message', (data) => {
      if (data.includes('bid_update')) {
        check(data, { 'ws update received': (d) => d.includes('product') });
      }
    });
    socket.on('close', () => console.log('WebSocket disconnected'));
  });
}
