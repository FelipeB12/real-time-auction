/**
 * @fileoverview Main Application entry point for the Auction UI.
 *
 * Displays auction items fetched from the backend and auto-polls every 3 seconds
 * so newly seeded products (from k6 or the seed button) appear without a manual refresh.
 */

import { useState, useEffect, useCallback } from 'react';
import { Zap, ShieldCheck, PlusCircle, RefreshCw } from 'lucide-react';
import { AuctionItem } from './components/AuctionItem';
import './App.css';

const API_URL = 'http://localhost:3000/api';

function App() {
  const [userId] = useState(() => `user_${Math.floor(Math.random() * 1000)}`);
  const [demoItems, setDemoItems] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);

  /** Fetch all products and populate the auction grid. */
  const fetchProducts = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/products`);
      const data = await response.json();
      if (Array.isArray(data)) {
        setDemoItems(data.slice(0, 3).map((p: any) => p.id));
      }
    } catch (error) {
      console.error('[App] Failed to fetch products:', error);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  // Initial load + auto-poll every 3 s so products seeded by k6 appear immediately.
  useEffect(() => {
    fetchProducts();
    const poller = setInterval(() => fetchProducts(true), 3000);
    return () => clearInterval(poller);
  }, [fetchProducts]);

  /** POST a demo product so we can start bidding on a fresh database. */
  const handleSeed = async () => {
    setIsSeeding(true);
    setSeedError(null);
    try {
      const res = await fetch(`${API_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Live Auction — Demo Item',
          description: 'Seeded from the UI for real-time bidding demo',
          current_price: 100,
        }),
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      await fetchProducts();
    } catch (err: any) {
      setSeedError(err.message || 'Seed failed');
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <div className="logo">
          <Zap fill="currentColor" size={24} />
          SISU Auction
        </div>

        <div className="status-badge">
          <ShieldCheck size={16} color="#3b82f6" />
          <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>Connected to Sockets</span>
        </div>
      </header>

      <main>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.5 }}>
            <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: '1rem' }} />
            <div>Loading live auctions…</div>
          </div>
        ) : demoItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <p style={{ color: '#ef4444', marginBottom: '1.5rem', fontSize: '1rem' }}>
              No active auctions found. Run a k6 load test or seed the database below.
            </p>
            <button
              onClick={handleSeed}
              disabled={isSeeding}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.5rem',
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: '0.95rem',
                cursor: isSeeding ? 'not-allowed' : 'pointer',
                opacity: isSeeding ? 0.6 : 1,
                transition: 'opacity 0.2s',
              }}
            >
              <PlusCircle size={18} />
              {isSeeding ? 'Seeding…' : 'Seed Auction Product'}
            </button>
            {seedError && (
              <p style={{ color: '#ef4444', marginTop: '0.75rem', fontSize: '0.85rem' }}>
                Error: {seedError}
              </p>
            )}
            <p style={{ marginTop: '1.5rem', color: '#64748b', fontSize: '0.8rem' }}>
              (The UI auto-refreshes every 3s — k6 products will appear automatically)
            </p>
          </div>
        ) : (
          <div className="auction-grid">
            {demoItems.map(id => (
              <AuctionItem key={id} itemId={id} userId={userId} />
            ))}
          </div>
        )}
      </main>

      <footer>
        <p>Built with NestJS + React + Redis + PostgreSQL</p>
        <p style={{ marginTop: '0.5rem', opacity: 0.6 }}>High-Frequency Auction Platform (Bonus B and AImplemented)</p>
      </footer>
    </div>
  );
}

export default App;


