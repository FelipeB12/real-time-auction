/**
 * @fileoverview Custom hook for high-frequency WebSocket auction updates.
 *
 * ARCHITECTURAL ROLE:
 * This hook implements a crucial "Performance Buffer" strategy to protect the
 * frontend from being overwhelmed by millisecond-level updates.
 *
 * STRATEGY:
 * 1. **Capture:** Listen for `bid_update` events via Socket.io.
 * 2. **Buffer:** Accumulate ALL incoming events into a `useRef` array. Because
 *    refs are mutable, this does NOT trigger React re-renders — crucial at
 *    high bid frequency.
 * 3. **Flush:** A fixed 100ms `setInterval` drains the buffer and dispatches the
 *    entire batch to the consumer. This decouples data receipt from rendering,
 *    ensuring the UI stays at a smooth 10fps regardless of bid rate.
 *
 * WHY onUpdateRef:
 *    The `onUpdate` callback passed by the parent is a new function reference on
 *    every render. If we included it in the `useEffect` dependency array the
 *    socket would disconnect and reconnect on EVERY render — losing buffered
 *    events and resetting counters. Storing it in a ref lets us always call the
 *    latest version of the callback without touching the socket lifecycle.
 */

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { BidEvent, BidRejectedEvent } from '@auction/shared';

export const useAuctionSocket = (
  itemId: string,
  onUpdate: (events: BidEvent[]) => void,
  onRejected: (events: BidRejectedEvent[]) => void,
) => {
  const socketRef = useRef<Socket | null>(null);
  const bufferRef = useRef<BidEvent[]>([]);
  const rejectedBufferRef = useRef<BidRejectedEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  /**
   * Store the latest onUpdate callback in a ref so the flush interval always
   * calls the current version without being listed as a dependency of the
   * socket effect (which would cause constant reconnects).
   */
  const onUpdateRef = useRef(onUpdate);
  const onRejectedRef = useRef(onRejected);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
    onRejectedRef.current = onRejected;
  }, [onUpdate, onRejected]);

  // Hardcoded Socket URL for demo.
  const SOCKET_URL = 'http://localhost:3000/auction';

  useEffect(() => {
    // Initialize socket connection — runs ONCE per itemId change.
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      console.log(`[AuctionSocket] Connected for item ${itemId}`);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log(`[AuctionSocket] Disconnected for item ${itemId}`);
    });

    // — Capture Step:
    // Push every incoming bid event into the buffer array.
    // Using push() on a ref is O(1) and causes zero re-renders.
    socket.on('bid_update', (event: BidEvent) => {
      if (event.item_id === itemId) {
        bufferRef.current.push(event);
      }
    });

    socket.on('bid_rejected', (event: BidRejectedEvent) => {
      if (event.item_id === itemId) {
        rejectedBufferRef.current.push(event);
      }
    });

    // — Flush Step:
    // Every 100ms drain the buffer and fire the consumer's callback with the
    // complete batch. Using onUpdateRef.current means we always call the latest
    // callback without making it a dependency of this effect.
    const flushInterval = setInterval(() => {
      // Flush accepted bids
      if (bufferRef.current.length > 0) {
        const batch = [...bufferRef.current];
        bufferRef.current = [];
        onUpdateRef.current(batch);
      }

      // Flush rejected bids
      if (rejectedBufferRef.current.length > 0) {
        const rejectedBatch = [...rejectedBufferRef.current];
        rejectedBufferRef.current = [];
        onRejectedRef.current(rejectedBatch);
      }
    }, 100);

    return () => {
      socket.disconnect();
      clearInterval(flushInterval);
    };
    // ↑ Only re-run when itemId changes — NOT when onUpdate changes.
  }, [itemId]);

  return { isConnected };
};
