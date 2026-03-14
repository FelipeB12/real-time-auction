/**
 * @fileoverview AuctionItem component.
 * 
 * This component represents a single auctionable product. It handles the initial 
 * state fetch via REST and provides an interface for users to place new bids.
 * 
 * PERFORMANCE NOTE:
 * Price updates are designed to be "flashy" but efficient. In Step 2, we will 
 * integrate the buffering logic to handle high-frequency WebSocket updates.
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Gavel, AlertCircle } from 'lucide-react';
import type { Product, BidResult } from '@auction/shared';

interface AuctionItemProps {
  itemId: string;
  userId: string;
}

export const AuctionItem: React.FC<AuctionItemProps> = ({ itemId, userId }) => {
  const [product, setProduct] = useState<Product | null>(null);
  const [bidAmount, setBidAmount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Hardcoded API URL for the demo. In production, this would come from an environment variable.
  const API_URL = 'http://localhost:3000/api';

  useEffect(() => {
    fetchInitialState();
  }, [itemId]);

  const fetchInitialState = async () => {
    try {
      setLoading(true);
      const response = await axios.get<Product>(`${API_URL}/auction/${itemId}/state`);
      setProduct(response.data);
      setBidAmount(Math.floor(response.data.current_price + 10)); // Default next bid
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to connect to auction server');
    } finally {
      setLoading(false);
    }
  };

  const handlePlaceBid = async () => {
    if (bidAmount <= (product?.current_price || 0)) {
      setError('Bid must be higher than current price');
      return;
    }

    try {
      setError(null);
      const response = await axios.post<BidResult>(
        `${API_URL}/place-bid`,
        {
          item_id: itemId,
          user_id: userId,
          amount: bidAmount,
        },
        {
          headers: {
            'Idempotency-Key': `${userId}-${Date.now()}`, // Simple unique key for demo
          },
        }
      );

      if (response.data.success) {
        // Optimistic local update before WebSocket confirms it
        setIsUpdating(true);
        setTimeout(() => setIsUpdating(false), 1000);
      }
    } catch (err: any) {
      console.error('Bid failed:', err.response?.data);
      setError(err.response?.data?.message || 'Bid rejected');
    }
  };

  if (loading) return <div className="auction-card loading">Loading item...</div>;
  if (!product) return <div className="auction-card error">Item not found</div>;

  return (
    <div className="auction-card">
      <div className="card-content">
        <h2 className="item-name">{product.name}</h2>
        <p className="item-description">{product.description || 'Exclusive auction item.'}</p>
        
        <div className="price-section">
          <span className="price-label">Current Highest Bid</span>
          <div className={`current-price ${isUpdating ? 'flash-update' : ''}`}>
            <span className="currency">$</span>
            {product.current_price.toLocaleString()}
          </div>
        </div>

        <div className="bid-input-group">
          <input
            type="number"
            value={bidAmount}
            onChange={(e) => setBidAmount(Number(e.target.value))}
            min={product.current_price + 1}
          />
          <button 
            className="bid-button" 
            onClick={handlePlaceBid}
            disabled={product.current_price >= bidAmount}
          >
            <Gavel size={18} />
            Place Bid
          </button>
        </div>

        {error && (
          <div className="error-message">
            <AlertCircle size={14} />
            {error}
          </div>
        )}
      </div>
    </div>
  );
};
