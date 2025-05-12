// src/components/ChatInterface.jsx
import React, { useState, useEffect, useRef } from 'react';
import ChatMessage from './ChatMessage';
import LoadingIndicator from './LoadingIndicator';
import { processTriageMessage } from '../services/triageService';

function ChatInterface({ chatHistory, setChatHistory, patientData, onComplete }) {
  const [userInput, setUserInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef(null);
  
  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // Initial message from the system when first mounted
  useEffect(() => {
    if (chatHistory.length === 1) {
      setTimeout(() => {
        const initialQuestion = {
          role: 'assistant',
          content: `Could you please tell me more about your ${patientData.chiefComplaint.toLowerCase()}? When did it start, and how severe is it on a scale of 1-10?`
        };
        setChatHistory(prev => [...prev, initialQuestion]);
      }, 1000);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userInput.trim() || isProcessing) return;
    
    // Add user message to chat
    const userMessage = {
      role: 'user',
      content: userInput
    };
    
    setChatHistory(prev => [...prev, userMessage]);
    setUserInput('');
    setIsProcessing(true);
    
    try {
      // Process the user's message and get AI response
      const response = await processTriageMessage(
        chatHistory.concat(userMessage),
        patientData
      );
      
      // Check if triage is complete
      if (response.complete) {
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: response.message
        }]);
        
        setTimeout(() => {
          onComplete(response.result);
        }, 2000);
      } else {
        // Continue the conversation
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: response.message
        }]);
      }
    } catch (error) {
      console.error("Error processing triage message:", error);
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: "I'm sorry, I encountered an error processing your response. Could you please try again?"
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="chat-interface">
      <div className="chat-header">
        <h2>Medical Assessment</h2>
        <p>Please answer the questions to help us understand your condition.</p>
      </div>
      
      <div className="chat-messages">
        {chatHistory.map((message, index) => (
          <ChatMessage key={index} message={message} />
        ))}
        {isProcessing && (
          <div className="message-loading">
            <LoadingIndicator size="small" />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <form className="chat-input-form" onSubmit={handleSubmit}>
        <textarea
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="Type your response here..."
          disabled={isProcessing}
          rows={3}
        />
        <button 
          type="submit" 
          className="send-button"
          disabled={isProcessing || !userInput.trim()}
        >
          Send
        </button>
      </form>
      
      <div className="chat-disclaimer">
        <p>
          <strong>Note:</strong> This is an automated triage system. In case of emergency, 
          please call emergency services immediately.
        </p>
      </div>
    </div>
  );
}

export default ChatInterface;