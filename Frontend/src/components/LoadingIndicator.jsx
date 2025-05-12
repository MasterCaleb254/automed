// src/components/LoadingIndicator.jsx
import React from 'react';
import './LoadingIndicator.css'; // We’ll create this CSS next

function LoadingIndicator({ size = 'medium' }) {
  return (
    <div className={`loading-indicator ${size}`}>
      <div className="spinner"></div>
      <span className="loading-text">Processing...</span>
    </div>
  );
}

export default LoadingIndicator;

