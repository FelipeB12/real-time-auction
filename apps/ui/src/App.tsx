/**
 * @fileoverview Main Application entry point for the Auction UI.
 * 
 * This application demonstrates a high-frequency auction dashboard.
 * It uses a shared layout and displays several auction items which 
 * synchronize their state with the NestJS backend.
 */

import { useState } from 'react';
import { Zap, ShieldCheck } from 'lucide-react';
import { AuctionItem } from './components/AuctionItem';
import './App.css';

function App() {
  const [userId] = useState(() => `user_${Math.floor(Math.random() * 1000)}`);
  
  // Example item IDs. In a real app, these would be fetched from /api/products
  const [demoItems] = useState([
    'product-1', // Assuming these exist from Phase 1 seeding
    'product-2'
  ]);

  return (
    <div className="app-container">
      <header className="header">
        <div className="logo">
          <Zap fill="currentColor" size={24} />
          SISU Auction
        </div>
        
        <div className="status-badge">
          <ShieldCheck size={16} color="#3b82f6" />
          User ID: <span style={{ color: '#3b82f6', fontWeight: 600 }}>{userId}</span>
          <div className="status-indicator connected"></div>
          <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>Connected to Sockets</span>
        </div>
      </header>

      <main>
        <div className="auction-grid">
          {demoItems.map(id => (
            <AuctionItem key={id} itemId={id} userId={userId} />
          ))}
        </div>
      </main>

      <footer style={{ marginTop: '4rem', padding: '2rem 0', borderTop: '1px solid var(--border-color)', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
        <p>Built with NestJS + React + Redis + PostgreSQL</p>
        <p style={{ marginTop: '0.5rem', opacity: 0.6 }}>High-Frequency Auction Platform (Bonus B Implementation)</p>
      </footer>
    </div>
  );
}

export default App;
