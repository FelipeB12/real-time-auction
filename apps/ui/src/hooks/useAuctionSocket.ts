/**
 * @fileoverview Custom hook for high-frequency WebSocket auction updates.
 *
 * ARCHITECTURAL ROLE:
 * This hook implements a crucial "Performance Buffer" strategy to protect the 
 * frontend from being overwhelmed by millisecond-level updates. 
 *
 * STRATEGY:
 * 1. **Capture:** Listen for `bid_update` events via Socket.io.
 * 2. **Buffer:** Store the latest price update in a mutable `useRef`. This 
 *    prevents immediate React re-renders which are expensive at high frequency.
 * 3. **Flush:** Use a fixed interval (100ms) to sync the buffer with the 
 *    component state. This ensures the UI updates at a smooth 10fps, keeping
 *    the browser responsive even during intense bidding wars.
 */

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { BidEvent } from '@auction/shared';

export const useAuctionSocket = (itemId: string, onUpdate: (event: BidEvent) => void) => {
  const socketRef = useRef<Socket | null>(null);
  const bufferRef = useRef<BidEvent | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Hardcoded Socket URL for demo.
  const SOCKET_URL = 'http://localhost:3000/auction';

  useEffect(() => {
    // Initialize socket connection
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      console.log(`Connected to auction socket for ${itemId}`);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Listen for global bid updates
    socket.on('bid_update', (event: BidEvent) => {
      // Filter updates only for the item we care about
      if (event.item_id === itemId) {
        // — Performance Buffer Step:
        // Instead of calling setState here (which would trigger a re-render
        // on every single packet), we store the update in a mutable ref.
        bufferRef.current = event;
      }
    });

    // — Flush Loop Step:
    // Create an interval to "flush" the buffer into the state at 100ms intervals.
    // This provides a smooth visual experience while significantly reducing CPU load.
    const flushInterval = setInterval(() => {
      if (bufferRef.current) {
        onUpdate(bufferRef.current);
        bufferRef.current = null; // Clear buffer after flush
      }
    }, 100);

    return () => {
      socket.disconnect();
      clearInterval(flushInterval);
    };
  }, [itemId, onUpdate]);

  return { isConnected };
};
