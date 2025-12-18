import React, { useState, useEffect, useRef } from 'react';
import { useKronosAPI } from '../hooks/useKronosAPI';
import '../App.css';

function ChatInterface({ config }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedModel, setSelectedModel] = useState('unified');
  
  const messagesEndRef = useRef(null);
  
  const { getAppInfo } = useKronosAPI();

  useEffect(() => {
    // Scroll to bottom when new messages are added
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isTyping) return;

    // Add user message
    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputValue.trim(),
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    try {
      // Simulate AI response
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
      
      const aiResponse = {
        id: Date.now(),
        type: 'ai',
        content: generateAIResponse(inputValue),
        timestamp: new Date().toISOString(),
        model: selectedModel
      };
      
      setMessages(prev => [...prev, aiResponse]);
    } catch (error) {
      console.error('Failed to get AI response:', error);
      
      const errorMessage = {
        id: Date.now(),
        type: 'error',
        content: 'Sorry, I encountered an error processing your request.',
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const generateAIResponse = (userInput) => {
    const lowerInput = userInput.toLowerCase();
    
    // Simple rule-based responses
    if (lowerInput.includes('hello') || lowerInput.includes('hi')) {
      return "Hello! I'm KRONOS AI assistant. I can help you with computer automation, web scraping, image analysis, and system monitoring. What would you like to do?";
    }
    
    if (lowerInput.includes('screenshot') || lowerInput.includes('screen')) {
      return "I can capture screenshots using the embedded computer vision service. Would you like me to take a screenshot now?";
    }
    
    if (lowerInput.includes('automate') || lowerInput.includes('automation')) {
      return "I can help automate web tasks using Puppeteer. Please specify the website or task you'd like me to automate.";
    }
    
    if (lowerInput.includes('android') || lowerInput.includes('phone')) {
      return "I can control Android devices through ADB. What specific Android task would you like me to perform?";
    }
    
    if (lowerInput.includes('vision') || lowerInput.includes('ocr')) {
      return "I can analyze images and extract text using computer vision capabilities. Please provide an image for analysis.";
    }
    
    if (lowerInput.includes('status') || lowerInput.includes('health')) {
      return "I can check the status of all AI services and system resources. Would you like me to run a health check?";
    }
    
    // Default response
    const suggestions = [
      "Take a screenshot",
      "Automate a web task", 
      "Control Android device",
      "Analyze an image",
      "Check system status"
    ];
    
    return `I understand you're interested in "${userInput}". I can help you with various AI-powered tasks including: ${suggestions.join(', ')}. What specific task would you like assistance with?`;
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      handleSendMessage();
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg h-full flex flex-col">
      {/* Chat Header */}
      <div className="bg-gray-700 border-b border-gray-600 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">AI Assistant</h3>
          
          <div className="flex items-center space-x-4">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-gray-600 border border-gray-500 rounded px-3 py-1 text-white text-sm"
            >
              <option value="unified">Unified AI</option>
              <option value="web-automation">Web Automation</option>
              <option value="computer-vision">Computer Vision</option>
              <option value="android-control">Android Control</option>
            </select>
            
            <div className="text-xs text-gray-400">
              Model: {selectedModel}
            </div>
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ minHeight: '400px' }}>
        {messages.length === 0 && (
          <div className="text-center text-gray-400 py-8">
            <div className="text-2xl mb-2">👋</div>
            <p className="mb-2">Start a conversation with KRONOS AI</p>
            <p className="text-sm">
              I can help you with computer automation, web scraping, image analysis, and more.
            </p>
            <div className="space-x-2 flex justify-center">
              <button 
                onClick={() => setInputValue('Help me understand KRONOS capabilities')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
              >
                Tell me more
              </button>
            </div>
          </div>
        )}
        
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'} mb-4`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
                message.type === 'user' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-700 text-white'
              }`}
            >
              <div className="text-xs text-gray-400 mb-1">
                {new Date(message.timestamp).toLocaleTimeString()}
              </div>
              
              <div className={`text-sm ${message.type === 'error' ? 'text-red-400' : 'text-gray-300'}`}>
                {message.content}
              </div>
              
              {message.model && (
                <div className="text-xs text-blue-400 mt-1">
                  Model: {message.model}
                </div>
              )}
            </div>
            
            <div className="w-2 h-2 rounded-full bg-gray-600 flex items-center justify-center">
              {message.type === 'user' && (
                <div className="w-1 h-1 bg-blue-400 rounded-full"></div>
              )}
            </div>
          </div>
        ))}
        
        {isTyping && (
          <div className="flex justify-start mb-4">
            <div className="bg-gray-700 text-white px-4 py-3 rounded-lg max-w-xs">
              <div className="flex items-center space-x-2">
                <div className="animate-spin inline-block w-4 h-4 border-2 border-t-blue-500 border-gray-300 rounded-full"></div>
                <span className="text-sm">KRONOS is thinking...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-600 p-4">
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask KRONOS AI anything..."
            className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isTyping}
          />
          
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isTyping}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors duration-200"
          >
            Send
          </button>
        </div>
        
        <div className="flex items-center space-x-4 text-xs text-gray-400 mt-2">
          <span>Press Enter to send</span>
          <span>• Supports screenshots, web automation, OCR, and Android control</span>
        </div>
      </div>
    </div>
  );
}

export default ChatInterface;
