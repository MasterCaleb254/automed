// services/llmService.js
const axios = require('axios');
const config = require('../config/llm');
const { LangChainAdapter } = require('../utils/langChainAdapter');

// Initialize LLM client
let llmClient;

// Setup and select LLM provider based on configuration
if (config.provider === 'openai') {
  // Use OpenAI directly
  llmClient = axios.create({
    baseURL: 'https://api.openai.com/v1',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json'
    }
  });
} else if (config.provider === 'langchain') {
  // Use LangChain for local models or other providers
  llmClient = new LangChainAdapter(config);
}

// Generate a response using the configured LLM
exports.generateResponse = async (systemContext, messages, instruction = null) => {
  try {
    if (config.provider === 'openai') {
      // Format messages for OpenAI API
      const formattedMessages = [
        { role: 'system', content: systemContext },
        ...messages
      ];
      
      if (instruction) {
        formattedMessages.push({ role: 'system', content: instruction });
      }
      
      const response = await llmClient.post('/chat/completions', {
        model: config.model, // e.g., 'gpt-4'
        messages: formattedMessages,
        temperature: 0.3, // Lower temperature for more consistent medical responses
        max_tokens: 1000
      });
      
      return response.data.choices[0].message.content;
    } 
    else if (config.provider === 'langchain') {
      // Use LangChain adapter
      return await llmClient.generateResponse(systemContext, messages, instruction);
    }
  } catch (error) {
    console.error('LLM service error:', error);
    throw new Error('Failed to generate response from language model');
  }
};

// Generate analysis for triage completion
exports.generateAnalysis = async (messages, analysisPrompt) => {
  try {
    if (config.provider === 'openai') {
      // Create a structured analysis prompt
      const formattedMessages = [
        ...messages,
        { 
          role: 'system', 
          content: `${analysisPrompt}
            
          Respond in JSON format:
          {
            "canComplete": boolean,
            "urgencyLevel": "Emergency|Urgent|Semi-urgent|Non-urgent",
            "recommendedAction": "string",
            "reasoning": "string",
            "missingInformation": ["string"]
          }`
        }
      ];
      
      const response = await llmClient.post('/chat/completions', {
        model: config.model,
        messages: formattedMessages,
        temperature: 0.2,
        max_tokens: 500,
        response_format: { type: "json_object" }
      });
      
      // Parse the JSON response
      const analysisText = response.data.choices[0].message.content;
      return JSON.parse(analysisText);
    } 
    else if (config.provider === 'langchain') {
      return await llmClient.generateStructuredAnalysis(messages, analysisPrompt);
    }
  } catch (error) {
    console.error('LLM analysis error:', error);
    // Return a default "cannot complete" result on error
    return {
      canComplete: false,
      missingInformation: ["Unable to analyze due to system error"]
    };
  }
};