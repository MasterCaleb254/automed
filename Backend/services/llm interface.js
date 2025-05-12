// services/llmInterface.js
const axios = require('axios');
const { LLMChain, PromptTemplate } = require('langchain/chains');
const { OpenAI } = require('langchain/llms/openai');
const { HuggingFaceInference } = require('langchain/llms/hf');
const { ChatOpenAI } = require('langchain/chat_models/openai');
const { StringOutputParser } = require('langchain/schema/output_parser');
const config = require('../config/llm');
const logger = require('../utils/logging');

class LLMInterface {
  constructor() {
    this.provider = config.provider;
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.maxRetries = config.maxRetries || 3;
    this.initialized = false;
    this.tokenCounter = 0;
    this.client = null;
  }

  async initialize() {
    try {
      if (this.initialized) return;

      switch (this.provider) {
        case 'openai':
          this.client = axios.create({
            baseURL: 'https://api.openai.com/v1',
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json'
            },
            timeout: 30000
          });
          break;
          
        case 'langchain-openai':
          this.client = new ChatOpenAI({
            openAIApiKey: this.apiKey,
            modelName: this.model,
            temperature: 0.3,
            maxTokens: 1000,
            streaming: false
          });
          break;
          
        case 'langchain-local':
          // For local models like LLaMA, MPT, etc.
          this.client = new HuggingFaceInference({
            model: this.model,
            apiKey: this.apiKey, // HF token if needed
            temperature: 0.3,
            maxTokens: 1000
          });
          break;
          
        default:
          throw new Error(`Unsupported LLM provider: ${this.provider}`);
      }
      
      this.initialized = true;
      logger.info(`LLM Interface initialized: ${this.provider} - ${this.model}`);
    } catch (error) {
      logger.error(`Failed to initialize LLM interface: ${error.message}`);
      throw new Error(`LLM initialization error: ${error.message}`);
    }
  }

  /**
   * Generate a response using the medical triage system prompt
   * @param {string} systemPrompt - System prompt with medical context
   * @param {Array} messages - Conversation history
   * @param {string|null} instruction - Optional additional instruction
   * @returns {Promise<string>} - Generated response
   */
  async generateResponse(systemPrompt, messages, instruction = null) {
    await this.initialize();
    
    // Add retries for resilience
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        let response;
        
        // OpenAI direct API
        if (this.provider === 'openai') {
          const formattedMessages = [
            { role: 'system', content: systemPrompt },
            ...messages
          ];
          
          if (instruction) {
            formattedMessages.push({ role: 'system', content: instruction });
          }
          
          const apiResponse = await this.client.post('/chat/completions', {
            model: this.model,
            messages: formattedMessages,
            temperature: 0.3,
            max_tokens: 1000
          });
          
          response = apiResponse.data.choices[0].message.content;
          
          // Track token usage
          this.tokenCounter += apiResponse.data.usage.total_tokens;
        } 
        // LangChain OpenAI
        else if (this.provider === 'langchain-openai') {
          const formattedMessages = [];
          
          // Add system message
          formattedMessages.push({
            role: 'system',
            content: systemPrompt
          });
          
          // Add conversation history
          for (const msg of messages) {
            formattedMessages.push({
              role: msg.role,
              content: msg.content
            });
          }
          
          // Add instruction if provided
          if (instruction) {
            formattedMessages.push({
              role: 'system',
              content: instruction
            });
          }
          
          const result = await this.client.call(formattedMessages);
          response = result.content;
        }
        // Local models via LangChain
        else if (this.provider === 'langchain-local') {
          // Combine the conversation for models that don't support chat format
          let combinedContext = `SYSTEM: ${systemPrompt}\n\n`;
          
          messages.forEach(msg => {
            if (msg.role === 'user') {
              combinedContext += `HUMAN: ${msg.content}\n`;
            } else if (msg.role === 'assistant') {
              combinedContext += `AI: ${msg.content}\n`;
            }
          });
          
          if (instruction) {
            combinedContext += `INSTRUCTION: ${instruction}\n`;
          }
          
          combinedContext += "AI:";
          
          const promptTemplate = PromptTemplate.fromTemplate(combinedContext);
          const chain = new LLMChain({
            llm: this.client,
            prompt: promptTemplate,
            outputParser: new StringOutputParser()
          });
          
          const result = await chain.call({});
          response = result.text;
        }
        
        return this.sanitizeResponse(response);
      } catch (error) {
        const isLastAttempt = attempt === this.maxRetries;
        
        logger.error(`LLM request failed (attempt ${attempt}/${this.maxRetries}): ${error.message}`);
        
        // If it's a rate limit or server error, retry after a delay
        if ((error.response?.status === 429 || error.response?.status >= 500) && !isLastAttempt) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          logger.info(`Retrying after ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else if (isLastAttempt) {
          // If all retries failed, throw error
          throw new Error(`Failed to generate LLM response after ${this.maxRetries} attempts: ${error.message}`);
        }
      }
    }
  }
  
  /**
   * Generate structured analysis output from the LLM
   * @param {Array} messages - Conversation history
   * @param {string} analysisPrompt - Prompt for analysis
   * @returns {Promise<Object>} - Structured analysis result
   */
  async generateStructuredAnalysis(messages, analysisPrompt) {
    await this.initialize();
    
    try {
      if (['openai', 'langchain-openai'].includes(this.provider)) {
        // Create a structured analysis prompt with JSON output format
        const structuredPrompt = `${analysisPrompt}
        
        Respond in JSON format:
        {
          "canComplete": boolean,
          "urgencyLevel": "Emergency|Urgent|Semi-urgent|Non-urgent",
          "recommendedAction": "string",
          "reasoning": "string",
          "missingInformation": ["string"]
        }`;
        
        // Get all messages except the system one
        const historyMessages = messages.filter(msg => msg.role !== 'system');
        
        // For OpenAI, we can request JSON format directly
        if (this.provider === 'openai') {
          const formattedMessages = [
            ...historyMessages,
            { role: 'system', content: structuredPrompt }
          ];
          
          const response = await this.client.post('/chat/completions', {
            model: this.model,
            messages: formattedMessages,
            temperature: 0.2,
            max_tokens: 500,
            response_format: { type: "json_object" }
          });
          
          // Parse the JSON response
          const analysisText = response.data.choices[0].message.content;
          
          try {
            return JSON.parse(analysisText);
          } catch (parseError) {
            logger.error(`Failed to parse LLM JSON output: ${parseError.message}`);
            return this.createFallbackAnalysis();
          }
        } 
        // LangChain OpenAI with structured format
        else if (this.provider === 'langchain-openai') {
          const formattedMessages = [];
          
          // Add conversation history
          for (const msg of historyMessages) {
            formattedMessages.push({
              role: msg.role,
              content: msg.content
            });
          }
          
          // Add analysis request
          formattedMessages.push({
            role: 'system',
            content: structuredPrompt
          });
          
          const result = await this.client.call(formattedMessages, {
            response_format: { type: "json_object" }
          });
          
          try {
            return JSON.parse(result.content);
          } catch (parseError) {
            logger.error(`Failed to parse LangChain JSON output: ${parseError.message}`);
            return this.createFallbackAnalysis();
          }
        }
      } 
      // For non-OpenAI models, we'll use a simpler approach
      else {
        // Generate a response with clear instructions for JSON format
        const analysisResult = await this.generateResponse(
          "You are a medical triage analysis system. Analyze the conversation and respond with a structured assessment.",
          messages,
          `${analysisPrompt}\nYou must respond in strict JSON format with no additional text.`
        );
        
        // Try to find and parse the JSON in the response
        const jsonMatch = analysisResult.match(/({[\s\S]*})/);
        if (jsonMatch) {
          try {
            return JSON.parse(jsonMatch[0]);
          } catch (parseError) {
            logger.error(`Failed to parse JSON from model output: ${parseError.message}`);
          }
        }
        
        // If parsing fails, return a default analysis
        return this.createFallbackAnalysis();
      }
    } catch (error) {
      logger.error(`Error generating structured analysis: ${error.message}`);
      return this.createFallbackAnalysis();
    }
  }
  
  /**
   * Create a fallback analysis for error cases
   */
  createFallbackAnalysis() {
    return {
      canComplete: false,
      missingInformation: ["Unable to complete analysis due to system error"]
    };
  }
  
  /**
   * Clean up the response text
   */
  sanitizeResponse(text) {
    if (!text) return '';
    
    // Remove any attempt by the LLM to continue the conversation as the human
    const humanPrefixes = ['Human:', 'User:', 'HUMAN:', 'USER:'];
    for (const prefix of humanPrefixes) {
      const index = text.indexOf(prefix);
      if (index !== -1) {
        text = text.substring(0, index).trim();
      }
    }
    
    return text;
  }
  
  /**
   * Get token usage statistics
   */
  getTokenUsage() {
    return {
      totalTokens: this.tokenCounter,
      estimatedCost: this.calculateCost()
    };
  }
  
  /**
   * Calculate estimated cost based on token usage and model
   */
  calculateCost() {
    // Very simplified cost calculation - actual rates would need updating
    const costPerToken = {
      'gpt-4': 0.00003,
      'gpt-3.5-turbo': 0.000002,
      'default': 0.00001
    };
    
    const rate = costPerToken[this.model] || costPerToken.default;
    return (this.tokenCounter * rate).toFixed(6);
  }
  
  /**
   * Reset token counter
   */
  resetTokenCounter() {
    this.tokenCounter = 0;
  }
}

// Export singleton instance
module.exports = new LLMInterface();