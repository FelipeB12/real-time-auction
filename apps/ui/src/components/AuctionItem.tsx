/**
 * @fileoverview AuctionItem component — The "Control Center" for a single auction item.
 *
 * ARCHITECTURAL ROLE:
 * This component is a high-frequency data orchestrator. It manages:
 *  1. Initial State: Fetches the authoritative product state from the REST API.
 *  2. Real-time Stream: Connects to a WebSocket namespace via `useAuctionSocket`.
 *  3. Performance Buffering: Receives batched updates every 100ms to prevent React render-thrashing.
 *  4. Optimistic Bidding: Fires REST requests and handles the resulting "Success" or "Stale" signals.
 *
 * MINIMALISTIC 3-COLUMN DESIGN:
 * Following professional UI standards, we've removed noisy global counters in favor of
 * a streamlined, data-dense 3-column architecture:
 *  - COLUMN 1: "BID COMMAND": Shows the absolute current price, active winner, and input controls.
 *  - COLUMN 2: "TRANSACTION LOG": A chronological feed of successful price movements.
 *  - COLUMN 3: "REJECTION FEED": Insights into failed bids, showing real-time competition.
 */

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Gavel, AlertCircle, ShieldCheck, XCircle, TrendingUp, History, Ban } from 'lucide-react';
import { useAuctionSocket } from '../hooks/useAuctionSocket';
import type { Product, BidResult, BidEvent, BidRejectedEvent } from '@auction/shared';

interface AuctionItemProps {
  itemId: string;
  userId: string;
}

/** 
 * Internal representation of a rejected bid attempt.
 * Extended with unique IDs for React list rendering stability.
 */
interface RejectedBid {
  id: string;
  reason: string;
  amount: number;
  bidder_id: string;
  timestamp: Date;
}

const API_URL = 'http://localhost:3000/api';
const MAX_FEED_SIZE = 50; // Keep the feeds shallow for DOM performance

export const AuctionItem: React.FC<AuctionItemProps> = ({ itemId, userId }) => {
  /* -------------------------------------------------------------------------- */
  /*                                CORE STATE                                  */
  /* -------------------------------------------------------------------------- */
  const [product, setProduct] = useState<Product | null>(null);
  const [bidAmount, setBidAmount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [stableConnected, setStableConnected] = useState(false);

  /* -------------------------------------------------------------------------- */
  /*                               FEED MANAGEMENT                              */
  /* -------------------------------------------------------------------------- */
  const [acceptedBids, setAcceptedBids] = useState<BidEvent[]>([]);
  const [rejectedBids, setRejectedBids] = useState<RejectedBid[]>([]);

  /* -------------------------------------------------------------------------- */
  /*                          WEBSOCKET BATCH HANDLERS                          */
  /* -------------------------------------------------------------------------- */

  /**
   * Processes a batch of successful bids.
   * Updates core item state and prepends the log feed.
   */
  const handleBidBatch = useCallback((events: BidEvent[]) => {
    const latestEvent = events[events.length - 1];

    setProduct((prev) =>
      prev
        ? {
            ...prev,
            current_price: Number(latestEvent.new_price), // Force Numeric
            highest_bidder_id: latestEvent.bidder_id,
          }
        : null
    );

    setAcceptedBids((prev) =>
      [...events.slice().reverse(), ...prev].slice(0, MAX_FEED_SIZE)
    );

    // Trigger visual feedback (price flash)
    setIsUpdating(true);
    setTimeout(() => setIsUpdating(false), 600);
  }, []);

  /**
   * Processes a batch of rejected bids from the network (including VUs).
   * Populates the Rejection Feed to provide visibility into competition density.
   */
  const handleRejectedBatch = useCallback((events: BidRejectedEvent[]) => {
    setRejectedBids((prev) => {
      const newItems: RejectedBid[] = events.map((e, i) => ({
        id: `${e.timestamp}-${i}-${Math.random()}`,
        reason: e.reason === 'STALE_BID' ? 'OUTBID' : e.reason,
        amount: e.attempted_amount,
        bidder_id: e.bidder_id,
        timestamp: new Date(e.timestamp),
      }));

      return [...newItems.reverse(), ...prev].slice(0, MAX_FEED_SIZE);
    });
  }, []);

  // Hook into the high-frequency performance buffer
  const { isConnected } = useAuctionSocket(itemId, handleBidBatch, handleRejectedBatch);

  /**
   * Connection Stability Logic:
   * Prevents UI "flicker" by waiting for a short grace period 
   * before showing a disconnected state.
   */
  useEffect(() => {
    if (isConnected) {
      setStableConnected(true);
    } else {
      const timeout = setTimeout(() => setStableConnected(false), 1500);
      return () => clearTimeout(timeout);
    }
  }, [isConnected]);

  /* -------------------------------------------------------------------------- */
  /*                            DATA SYNCHRONIZATION                            */
  /* -------------------------------------------------------------------------- */
  
  useEffect(() => {
    fetchInitialState();
    fetchBidHistory();
  }, [itemId]);

  const fetchInitialState = async () => {
    try {
      setLoading(true);
      const response = await axios.get<Product>(`${API_URL}/auction/${itemId}/state`);
      setProduct({
        ...response.data,
        current_price: Number(response.data.current_price) // Force Numeric
      });
      setBidAmount(Math.floor(Number(response.data.current_price) + 10)); // Default increment
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Connection to auction lost');
    } finally {
      setLoading(false);
    }
  };

  const fetchBidHistory = async () => {
    try {
      const response = await axios.get<BidEvent[]>(`${API_URL}/bids/${itemId}/history`);
      setAcceptedBids(response.data.slice(0, MAX_FEED_SIZE));
    } catch (err) {
      console.error('[AuctionItem] History fetch failed:', err);
    }
  };

  /* -------------------------------------------------------------------------- */
  /*                             BIDDING OPERATIONS                             */
  /* -------------------------------------------------------------------------- */

  const formatId = (id: string | null | undefined) => {
    if (!id) return 'None';
    // Showing full ID for Virtual Users as requested
    if (id.startsWith('vu-user-')) return id;
    return id.length > 12 ? id.substring(0, 10) + '…' : id;
  };

  /** Local rejection helper for manual attempts */
  const recordLocalRejection = (reason: string, amount: number) => {
    setRejectedBids((prev) => [
      {
        id: `${Date.now()}-${Math.random()}`,
        reason,
        amount,
        bidder_id: userId,
        timestamp: new Date()
      },
      ...prev,
    ].slice(0, MAX_FEED_SIZE));
  };

  /** Formal bidding via REST */
  const handlePlaceBid = async () => {
    const currentPrice = Number(product?.current_price || 0);
    if (Number(bidAmount) <= currentPrice) {
      setError('Price moved! Increase your bid.');
      return;
    }
    try {
      setError(null);
      const response = await axios.post<BidResult>(
        `${API_URL}/bids/place-bid`,
        { item_id: itemId, user_id: userId, amount: bidAmount },
        { headers: { 'Idempotency-Key': `${userId}-${Date.now()}` } }
      );
      if (response.data.success) {
        setSuccessMessage('Bid Accepted');
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err: any) {
      const code = err.response?.data?.error_code;
      const msg = err.response?.data?.message;
      if (code === 'STALE_BID') {
        setError('STALE: Someone outbid you!');
        recordLocalRejection('STALE', bidAmount);
      } else {
        setError(msg || 'Rejected');
        recordLocalRejection(msg || 'Error', bidAmount);
      }
    }
  };

  /** High-speed incremental bidding */
  const handleQuickBid = (increment: number) => {
    if (!product) return;
    const amount = Number(product.current_price) + increment; // Fix concatenation bug
    setBidAmount(amount);

    // Immediate execution for better UX
    (async () => {
      try {
        setError(null);
        await axios.post<BidResult>(
          `${API_URL}/bids/place-bid`,
          { item_id: itemId, user_id: userId, amount },
          { headers: { 'Idempotency-Key': `${userId}-${Date.now()}` } }
        );
        setSuccessMessage(`+$${increment.toLocaleString()} Placed!`);
        setTimeout(() => setSuccessMessage(null), 2000);
      } catch (e: any) {
        const code = e.response?.data?.error_code;
        if (code === 'STALE_BID') {
          setError('Too slow! Try a bigger leap.');
          recordLocalRejection('STALE', amount);
        }
      }
    })();
  };

  /* -------------------------------------------------------------------------- */
  /*                                  RENDERING                                 */
  /* -------------------------------------------------------------------------- */

  if (loading) return <div className="auction-card shimmer" style={{ minHeight: '400px' }} />;
  if (!product) return <div className="auction-card error">Auction Unavailable</div>;

  const isLeading = product.highest_bidder_id === userId;

  return (
    <div className="professional-auction-dashboard">
      {/* HEADER: Minimalist Title & Global Status */}
      <header className="dashboard-header-simple">
        <div className="title-group">
          <h2>{product.name}</h2>
          <div className={`connection-status ${stableConnected ? 'live' : 'sync'}`}>
            <span className="dot" />
            {stableConnected ? 'REAL-TIME PROXY ACTIVE' : 'RE-SYNCING...'}
          </div>
        </div>
        <div className="user-context">
          <span className="user-label">USER_ID</span>
          <span className="user-value">{formatId(userId)}</span>
        </div>
      </header>

      {/* THREE-COLUMN GRID */}
      <div className="three-column-grid">
        
        {/* COLUMN 1: BID COMMANDS */}
        <section className="column bid-command">
          <div className="column-header">
            <TrendingUp size={16} />
            <h3>BID COMMAND</h3>
          </div>
          
          <div className="main-price-card">
            <span className="label">CURRENT PRICE</span>
            <div className={`value ${isUpdating ? 'price-active' : ''}`}>
              <span className="currency">$</span>
              {product.current_price.toLocaleString()}
            </div>
          </div>

          <div className="winner-card">
            <span className="label">LEADING BIDDER</span>
            <div className={`winner-name ${isLeading ? 'is-me' : ''}`}>
              {formatId(product.highest_bidder_id)}
              {isLeading && <span className="leader-badge">WINNING</span>}
            </div>
          </div>

          <div className="bid-actions">
            <div className="input-group">
              <span className="symbol">$</span>
              <input
                type="number"
                value={bidAmount}
                onChange={(e) => setBidAmount(Number(e.target.value))}
                className="minimal-input"
              />
            </div>
            <button 
              className="place-bid-btn"
              onClick={handlePlaceBid}
              disabled={bidAmount <= product.current_price}
            >
              <Gavel size={18} />
              SEND BID
            </button>

            <div className="quick-leap-group">
              <button onClick={() => handleQuickBid(100)}>+100</button>
              <button onClick={() => handleQuickBid(200)}>+200</button>
              <button onClick={() => handleQuickBid(500)} className="leap">+500</button>
            </div>
          </div>

          {error && <div className="feedback-alert error-alert"><AlertCircle size={14} /> {error}</div>}
          {successMessage && <div className="feedback-alert success-alert"><ShieldCheck size={14} /> {successMessage}</div>}
        </section>

        {/* COLUMN 2: TRANSACTION LOG */}
        <section className="column transaction-log">
          <div className="column-header">
            <History size={16} />
            <h3>TRANSACTION LOG</h3>
          </div>
          <div className="feed-container">
            {acceptedBids.length === 0 ? (
              <div className="empty-feed">Listening for packets...</div>
            ) : (
              acceptedBids.map((bid, i) => (
                <div key={`${bid.timestamp}-${i}`} className="log-entry">
                  <div className="log-meta">
                    <span className="log-user">{formatId(bid.bidder_id)}</span>
                    <span className="log-time">{new Date(bid.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  </div>
                  <div className="log-price">${bid.new_price.toLocaleString()}</div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* COLUMN 3: REJECTION HISTORY */}
        <section className="column rejection-log">
          <div className="column-header">
            <Ban size={16} />
            <h3>REJECTED BIDS</h3>
          </div>
          <div className="feed-container">
            {rejectedBids.length === 0 ? (
              <div className="empty-feed">No rejections detected</div>
            ) : (
              rejectedBids.map((r) => (
                <div key={r.id} className="log-entry rejected">
                  <div className="log-meta">
                    <span className="log-user">{formatId(r.bidder_id)}</span>
                    <span className="log-reason">{r.reason}</span>
                  </div>
                  <div className="log-price">${r.amount.toLocaleString()}</div>
                </div>
              ))
            )}
          </div>
        </section>

      </div>
    </div>
  );
};
