/**
 * @fileoverview AuctionItem component — main dashboard for a single auctionable item.
 *
 * ARCHITECTURAL ROLE:
 * This is the primary user-facing component. It orchestrates:
 *  - Fetching initial item state via REST (GET /api/auction/:id/state)
 *  - Receiving live bid updates via the `useAuctionSocket` performance-buffer hook
 *  - Allowing the user to place manual bids via REST (POST /api/bids/place-bid)
 *
 * ANALYTICS BOARD DESIGN:
 *  - totalBids      : incremented by the exact batch size received each flush.
 *  - bidsPerSecond  : measured as the delta of totalBids over a 1-second window.
 *                     This avoids any artificial ceiling from a capped history array.
 *  - rejectedBids   : collected from both handlePlaceBid and handleQuickBid catch
 *                     blocks, shown in the new "Rejected Bids" panel.
 *  - acceptedBids   : live-updated from WebSocket flush batches (successful bids).
 */

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Gavel, AlertCircle, ShieldCheck, XCircle } from 'lucide-react';
import { useAuctionSocket } from '../hooks/useAuctionSocket';
import type { Product, BidResult, BidEvent, BidRejectedEvent } from '@auction/shared';

interface AuctionItemProps {
  itemId: string;
  userId: string;
}

/** A single entry in the rejected-bids feed */
interface RejectedBid {
  id: string;        // unique per rejection
  reason: string;
  amount: number;
  bidder_id: string;
  timestamp: Date;
}

const API_URL   = 'http://localhost:3000/api';

/** Max entries to keep in the accepted / rejected bid feeds */
const MAX_FEED_SIZE = 50;

export const AuctionItem: React.FC<AuctionItemProps> = ({ itemId, userId }) => {
  /* ----------------------------- Core state ----------------------------- */
  const [product, setProduct]               = useState<Product | null>(null);
  const [bidAmount, setBidAmount]           = useState<number>(0);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isUpdating, setIsUpdating]         = useState(false);
  const [stableConnected, setStableConnected] = useState(false);

  /* ----------------------------- Analytics ------------------------------ */
  const [acceptedBids, setAcceptedBids]     = useState<BidEvent[]>([]);
  const [rejectedBids, setRejectedBids]     = useState<RejectedBid[]>([]);

  /* ---------- Stabilize connection status (avoid rapid flickering) ------- */
  useEffect(() => {
    // We defer disconnect state by 1.5s to avoid UI flicker on reconnect.
  }, []);

  /* ---------------------- WebSocket batch handler ----------------------- */
  /**
   * onUpdate is called by the flush loop with every batch of successful bid events.
   * We use useCallback so the reference stays stable and doesn't needlessly
   * recreate the hook's onUpdateRef (though the hook handles this itself).
   */
  const handleBidBatch = useCallback((events: BidEvent[]) => {
    // Take the most recent event as the "current" state.
    const latestEvent = events[events.length - 1];

    setProduct((prev) =>
      prev
        ? {
            ...prev,
            current_price:      latestEvent.new_price,
            highest_bidder_id:  latestEvent.bidder_id,
            accepted_count:     latestEvent.accepted_count,
            rejected_count:     latestEvent.rejected_count,
          }
        : null
    );

    // Prepend batch to accepted bids feed (newest first), capped to MAX_FEED_SIZE.
    setAcceptedBids((prev) =>
      [...events.slice().reverse(), ...prev].slice(0, MAX_FEED_SIZE)
    );


    // Flash animation hint
    setIsUpdating(true);
    setTimeout(() => setIsUpdating(false), 600);
  }, []);

  /**
   * handleRejectedBatch is called by the socket hook with every batch of rejected bids
   * (both from this user and all other users/VUs).
   */
  const handleRejectedBatch = useCallback((events: BidRejectedEvent[]) => {
    // Update the aggregate counters from the latest event in the batch
    const latestEvent = events[events.length - 1];
    setProduct((prev) =>
      prev
        ? {
            ...prev,
            accepted_count: latestEvent.accepted_count,
            rejected_count: latestEvent.rejected_count,
          }
        : null
    );

    setRejectedBids((prev) => {
      const newItems: RejectedBid[] = events.map((e, i) => ({
        id: `${e.timestamp}-${i}-${Math.random()}`,
        reason: e.reason === 'STALE_BID' ? 'OUTBID — too slow' : e.reason,
        amount: e.attempted_amount,
        bidder_id: e.bidder_id,
        timestamp: new Date(e.timestamp),
      }));

      return [...newItems.reverse(), ...prev].slice(0, MAX_FEED_SIZE);
    });
  }, []);

  const { isConnected } = useAuctionSocket(itemId, handleBidBatch, handleRejectedBatch);

  /* --------- Stabilize connection status to prevent flickering ---------- */
  useEffect(() => {
    if (isConnected) {
      setStableConnected(true);
    } else {
      const timeout = setTimeout(() => setStableConnected(false), 1500);
      return () => clearTimeout(timeout);
    }
  }, [isConnected]);

  /* ----------------------------- Init fetches --------------------------- */
  useEffect(() => {
    fetchInitialState();
    fetchBidHistory();
  }, [itemId]);

  const fetchInitialState = async () => {
    try {
      setLoading(true);
      const response = await axios.get<Product>(`${API_URL}/auction/${itemId}/state`);
      setProduct(response.data);
      setBidAmount(Math.floor(response.data.current_price + 10));
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to connect to auction server');
    } finally {
      setLoading(false);
    }
  };

  const fetchBidHistory = async () => {
    try {
      const response = await axios.get<BidEvent[]>(
        `${API_URL}/bids/${itemId}/history`
      );
      setAcceptedBids(response.data.slice(0, MAX_FEED_SIZE));
    } catch (err) {
      console.error('[AuctionItem] Failed to fetch bid history:', err);
    }
  };

  /* ----------------------------- Bid helpers ---------------------------- */
  /** Helper to truncate long UUIDs/names to a readable label. */
  const formatId = (id: string | null | undefined) => {
    if (!id) return 'N/A';
    if (id.startsWith('vu-user-')) return id;
    return id.length > 12 ? id.substring(0, 10) + '…' : id;
  };

  /**
   * Record a rejected bid into the live feed (for LOCAL manual attempts).
   * Note: The socket hook now handles all broadcast rejections (including VUs).
   */
  const recordRejection = (reason: string, amount: number) => {
    setRejectedBids((prev) =>
      [
        {
          id: `${Date.now()}-${Math.random()}`,
          reason,
          amount,
          bidder_id: userId,
          timestamp: new Date()
        },
        ...prev,
      ].slice(0, MAX_FEED_SIZE)
    );
  };

  /* ----------------------------- Place bid ------------------------------ */
  const handlePlaceBid = async () => {
    if (bidAmount <= (product?.current_price || 0)) {
      setError('Bid must be higher than current price');
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
        setSuccessMessage('Bid placed successfully!');
        setTimeout(() => setSuccessMessage(null), 3000);
        setIsUpdating(true);
        setTimeout(() => setIsUpdating(false), 800);
      }
    } catch (err: any) {
      console.error('[AuctionItem] Bid failed:', err.response?.data);
      const code = err.response?.data?.error_code;
      const msg  = err.response?.data?.message;
      if (code === 'STALE_BID') {
        const reason = 'STALE — price moved too fast';
        setError(`${reason}. Try bidding at least $500 higher.`);
        recordRejection(reason, bidAmount);
      } else {
        setError(msg || 'Bid rejected');
        recordRejection(msg || 'Rejected', bidAmount);
      }
    }
  };

  /* ----------------------------- Quick bid ------------------------------ */
  const handleQuickBid = (increment: number) => {
    if (!product) return;
    const aggressiveAmount = product.current_price + increment + (increment > 100 ? 200 : 50);
    setBidAmount(aggressiveAmount);

    setTimeout(() => {
      (async () => {
        try {
          setError(null);
          await axios.post<BidResult>(
            `${API_URL}/bids/place-bid`,
            { item_id: itemId, user_id: userId, amount: aggressiveAmount },
            { headers: { 'Idempotency-Key': `${userId}-${Date.now()}` } }
          );
          setSuccessMessage(
            `Success! You outbid by $${(aggressiveAmount - product.current_price).toLocaleString()}!`
          );
          setTimeout(() => setSuccessMessage(null), 3000);
        } catch (e: any) {
          const code = e.response?.data?.error_code;
          const msg  = e.response?.data?.message;
          if (code === 'STALE_BID') {
            const reason = 'STALE — bots too fast';
            setError('STALE: The bots are too fast! Try the +$1,000 button.');
            recordRejection(reason, aggressiveAmount);
          } else {
            setError(msg || 'Quick bid failed');
            recordRejection(msg || 'Quick bid rejected', aggressiveAmount);
          }
        }
      })();
    }, 0);
  };

  /* ----------------------------- Render --------------------------------- */
  if (loading)
    return (
      <div className="auction-card shimmer" style={{ minHeight: '300px' }}>
        <div className="card-content">
          <div style={{ height: '24px', width: '60%', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', marginBottom: '1rem' }} />
          <div style={{ height: '16px', width: '90%', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', marginBottom: '2rem' }} />
          <div style={{ height: '40px', width: '40%', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }} />
        </div>
      </div>
    );

  if (!product) return <div className="auction-card error">Item not found</div>;

  return (
    <div className="auction-dashboard-item">
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <header className="dashboard-header">
        <div className="header-info">
          <h2 className="item-name">{product.name}</h2>
          <div className={`status-pill ${stableConnected ? 'live' : 'syncing'}`}>
            <span className="pulse-dot" />
            {stableConnected ? 'LIVE FEED' : 'SYNCING'}
          </div>
        </div>
        <div className="header-actions">
          <div className="user-indicator">
            <span className="user-id">ID: {formatId(userId)}</span>
            {product.highest_bidder_id === userId && (
              <span className="leader-badge">YOU ARE LEADING</span>
            )}
          </div>
        </div>
      </header>

      {/* ─── Stats Grid ─────────────────────────────────────────────── */}
      <div className="stats-grid single-stat">
        <div className="stat-card">
          <span className="stat-label">Current Winner</span>
          <div className="winner-display-box">
            <span className="stat-value winner">{formatId(product.highest_bidder_id)}</span>
          </div>
        </div>
      </div>

      {/* ─── Main Panel ─────────────────────────────────────────────── */}
      <div className="dashboard-main">
        {/* Left: Price & Bid Controls */}
        <section className="dashboard-column primary">
          <div className="price-display-container">
            <span className="price-label">CURRENT HIGHEST BID</span>
            <div className={`price-value ${isUpdating ? 'flash' : ''}`}>
              <span className="price-symbol">$</span>
              {product.current_price.toLocaleString()}
            </div>
          </div>

          <div className="bid-control-panel">
            <div className="input-wrapper">
              <span className="input-prefix">$</span>
              <input
                type="number"
                className="dashboard-input"
                value={bidAmount}
                onChange={(e) => setBidAmount(Number(e.target.value))}
                min={product.current_price + 1}
              />
            </div>
            <button
              className="dashboard-bid-button"
              onClick={handlePlaceBid}
              disabled={product.current_price >= bidAmount}
            >
              <Gavel size={20} />
              PLACE BID
            </button>

            <div className="quick-bid-row">
              <button className="quick-bid-btn"          onClick={() => handleQuickBid(100)}  title="Bid Current + $100">+$100</button>
              <button className="quick-bid-btn"          onClick={() => handleQuickBid(500)}  title="Bid Current + $500">+$500</button>
              <button className="quick-bid-btn featured" onClick={() => handleQuickBid(1000)} title="Bid Current + $1,000">+$1,000</button>
            </div>
          </div>

          {error          && <div className="dashboard-alert error">  <AlertCircle size={16} /> {error}</div>}
          {successMessage && <div className="dashboard-alert success"><ShieldCheck  size={16} /> {successMessage}</div>}
        </section>

        {/* Center: Accepted bids feed */}
        <aside className="dashboard-column secondary">
          <div className="live-feed-header">
            <h3>TRANSACTION LOG</h3>
            <div className="feed-status">LIVE</div>
          </div>
          <div className="live-feed-list">
            {acceptedBids.length === 0 ? (
              <div className="feed-empty">Waiting for incoming bid packets…</div>
            ) : (
              acceptedBids.map((bid, index) => (
                <div key={`${bid.timestamp}-${index}`} className="feed-item">
                  <div className="feed-item-meta">
                    <span className="feed-user">{formatId(bid.bidder_id)}</span>
                    <span className="feed-time">{new Date(bid.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="feed-price-group">
                    <div className="feed-price">${bid.new_price.toLocaleString()}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Right: Rejected bids feed */}
        <aside className="dashboard-column rejected-panel">
          <div className="live-feed-header rejected-header">
            <h3>REJECTED BIDS</h3>
            <XCircle size={16} className="rejected-icon" />
          </div>
          <div className="live-feed-list">
             {rejectedBids.length === 0 ? (
              <div className="feed-empty">No rejected bids yet</div>
            ) : (
              rejectedBids.map((r) => (
                <div key={r.id} className="feed-item rejected-item">
                  <div className="feed-item-meta">
                    <span className="feed-user">{formatId(r.bidder_id)}</span>
                    <span className="feed-user rejected-reason">{r.reason}</span>
                    <span className="feed-time">{r.timestamp.toLocaleTimeString()}</span>
                  </div>
                  <div className="feed-price-group">
                    <div className="feed-price rejected-amount">${r.amount.toLocaleString()}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};
