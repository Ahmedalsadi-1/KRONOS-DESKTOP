import React from 'react';
import { createRoot } from 'react-dom/client';
import ChatInterface from './components/ChatInterface';
import './App.css';

const rootEl = document.getElementById('app');

const App = () => (
  <div className="min-h-screen bg-gray-900 text-white">
    <ChatInterface config={{}} />
  </div>
);

if (rootEl) {
  const root = createRoot(rootEl);
  root.render(<App />);
}
