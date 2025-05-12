// src/components/ChatMessage.jsx
import React from 'react';

function ChatMessage({ message }) {
  const isUser = message.role === 'user';
  
  return (
    <div className={`chat-message ${isUser ? 'user-message' : 'assistant-message'}`}>
      <div className="message-avatar">
        {isUser ? (
          <div className="user-avatar">
            <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
            </svg>
          </div>
        ) : (
          <div className="assistant-avatar">
            <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
              <path d="M21.7 10.3l-9-8c-.4-.3-1-.3-1.4 0l-9 8c-.3.3-.5.7-.5 1.1v9c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-9c.1-.4-.1-.8-.4-1.1zm-10.7 9V12h2v7.3h-2zm6 0h-2v-3c0-.6-.4-1-1-1h-4c-.6 0-1 .4-1 1v3h-2v-7.8l5-4.5 5 4.5v7.8z" />
            </svg>
          </div>
        )}
      </div>
      <div className="message-content">
        <div className="message-text">{message.content}</div>
        <div className="message-time">
          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}

export default ChatMessage;