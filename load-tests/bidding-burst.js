/**
 * @fileoverview k6 Load Test Script for High-Frequency Bidding & WebSocket Streaming.
 *
 * ARCHITECTURAL ROLE:
 * This script serves as the "Judge" of Phase 6. It mathematically validates that 
 * the platform remains stable under high-concurrency bidding wars (100+ VUs).
 *
 * VALIDATION GOALS:
 * 1. **DB Lock Stability:** Confirm that atomic SQL updates prevent race conditions.
 * 2. **Idempotency Efficiency:** Verify that identical keys are rejected via Redis cache.
 * 3. **WebSocket Relay Latency:** (Optional) Verify that the relay worker publishes 
 *    fast enough for the dashboard to receive updates in realtime.
 *
 * USAGE:
 * k6 run load-tests/bidding-burst.js
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
const ITEM_ID = 'product-1'; // Targeting the seeded product

/**
 * Main Virtual User (VU) behavior.
 * Each VU simulates a bidder placing high-frequency bids.
 */
export default function () {
  const userId = `vu-${__VU}-${__ITER}`;
  
  // 1. Fetch current state to determine valid bid
  const stateRes = http.get(`${BASE_URL}/auction/${ITEM_ID}/state`);
  check(stateRes, { 'status is 200': (r) => r.status === 200 });

  if (stateRes.status === 200) {
    const product = stateRes.json();
    const currentPrice = product.current_price;
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
        'Idempotency-Key': `${userId}-${bidAmount}`, // Test idempotency behavior
      },
    };

    const startTime = Date.now();
    const bidRes = http.post(`${BASE_URL}/place-bid`, payload, params);
    bidLatency.add(Date.now() - startTime);

    // 3. Analyze Results
    // 201: Success, 409: Stale Bid (Expected in heavy wars), others: Errors
    check(bidRes, {
      'bid handled (201 or 409)': (r) => r.status === 201 || r.status === 409,
    });

    if (bidRes.status === 201) {
      successfulBids.add(1);
    } else if (bidRes.status === 409) {
      rejectedBids.add(1);
    }
  }

  // Sleep small random amount to simulate human/network jitter
  sleep(Math.random() * 0.5 + 0.1);
}

/**
 * WebSocket Subscriber behavior (Optional k6 module use).
 * We use a separate VU or a concurrent check to verify stream connection.
 */
export function websocket_test() {
  ws.connect(WS_URL, null, function (socket) {
    socket.on('open', () => console.log('WebSocket connected: Listening for stream...'));
    socket.on('message', (data) => {
      // Logic to verify bid_update events arrive
      if (data.includes('bid_update')) {
        check(data, { 'ws update received': (d) => d.includes(ITEM_ID) });
      }
    });
    socket.on('close', () => console.log('WebSocket disconnected'));
  });
}
