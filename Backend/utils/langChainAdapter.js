// utils/langChainAdapter.js
const { LLMChain, PromptTemplate, ConversationChain } = require('langchain/chains');
const { OpenAI } = require('langchain/llms/openai');
const { ChatOpenAI } = require('langchain/chat_models/openai');
const { HuggingFaceInference } = require('langchain/llms/hf');
const { LlamaCpp } = require('langchain/llms/llama_cpp'); 
const { StringOutputParser } = require('langchain/schema/output_parser');
const { BufferMemory, ConversationSummaryMemory } = require('langchain/memory');
const { HumanMessage, AIMessage, SystemMessage } = require('langchain/schema');
const logger = require('./logging');

class LangChainAdapter {
  constructor(config) {
    this.config = config;
    this.llm = null;
    this.chatModel = null;
    this.memory = null;
    this.initialized = false;
  }

  async initialize() {
    try {
      if (this.initialized) return;

      // Determine which model implementation to use
      const modelType = this.config.modelType || 'openai';
      
      switch (modelType) {
        case 'openai':
          this.llm = new OpenAI({
            openAIApiKey: this.config.apiKey,
            modelName: this.config.model,
            temperature: this.config.temperature || 0.3,
            maxTokens: this.config.maxTokens || 1000
          });
          
          this.chatModel = new ChatOpenAI({
            openAIApiKey: this.config.apiKey,
            modelName: this.config.model,
            temperature: this.config.temperature || 0.3,
            maxTokens: this.config.maxTokens || 1000
          });
          break;
          
        case 'huggingface':
          this.llm = new HuggingFaceInference({
            model: this.config.model,
            apiKey: this.config.apiKey,
            temperature: this.config.temperature || 0.3,
            maxTokens: this.config.maxTokens || 1000
          });
          break;
          
        case 'llama':
          this.llm = new LlamaCpp({
            modelPath: this.config.modelPath,
            temperature: this.config.temperature || 0.3,
            maxTokens: this.config.maxTokens || 1000,
            nCtx: 4096
          });
          break;
          
        default:
          throw new Error(`Unsupported model type: ${modelType}`);
      }
      
      // Initialize memory if needed
      if (this.config.useMemory) {
        if (this.config.memoryType === 'summary') {
          this.memory = new ConversationSummaryMemory({
            llm: this.llm,
            memoryKey: "chat_history",
            returnMessages: true
          });
        } else {
          this.memory = new BufferMemory({
            memoryKey: "chat_history",
            returnMessages: true
          });
        }
      }
      
      this.initialized = true;
      logger.info(`LangChain adapter initialized: ${modelType} - ${this.config.model}`);
    } catch (error) {
      logger.error(`Failed to initialize LangChain adapter: ${error.message}`);
      throw new Error(`LangChain initialization error: ${error.message}`);
    }
  }

  /**
   * Generate a response using LangChain
   * @param {string} systemContext - System prompt with medical context
   * @param {Array} messages - Conversation history
   * @param {string|null} instruction - Optional additional instruction
   * @returns {Promise<string>} - Generated response
   */
  async generateResponse(systemContext, messages, instruction = null) {
    await this.initialize();
    
    try {
      // Use chat model if available (better for conversation)
      if (this.chatModel) {
        const formattedMessages = [
          new SystemMessage(systemContext)
        ];
        
        // Add conversation history
        for (const msg of messages) {
          if (msg.role === 'user') {
            formattedMessages.push(new HumanMessage(msg.content));
          } else if (msg.role === 'assistant') {
            formattedMessages.push(new AIMessage(msg.content));
          }
        }
        
        // Add instruction if provided
        if (instruction) {
          formattedMessages.push(new SystemMessage(instruction));
        }
        
        const result = await this.chatModel.call(formattedMessages);
        return result.content;
      } 
      // Use standard LLM with a formatted prompt
      else {
        let combinedContext = `SYSTEM: ${systemContext}\n\n`;
        
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
          llm: this.llm,
          prompt: promptTemplate,
          outputParser: new StringOutputParser()
        });
        
        const result = await chain.call({});
        return result.text;
      }
    } catch (error) {
      logger.error(`LangChain response generation error: ${error.message}`);
      throw new Error(`Failed to generate response: ${error.message}`);
    }
  }
  
  /**
   * Generate structured analysis using LangChain
   * @param {Array} messages - Conversation history
   * @param {string} analysisPrompt - Prompt for analysis
   * @returns {Promise<Object>} - Structured analysis result
   */
  async generateStructuredAnalysis(messages, analysisPrompt) {
    await this.initialize();
    
    try {
      // Create a structured context for the analysis
      const structuredPrompt = `
        You are a medical triage analysis system. Review the following conversation 
        and provide a structured assessment. ${analysisPrompt}
        
        Respond in strict JSON format like this:
        {
          "canComplete": boolean,
          "urgencyLevel": "Emergency|Urgent|Semi-urgent|Non-urgent",
          "recommendedAction": "string",
          "reasoning": "string",
          "missingInformation": ["string"]
        }
        
        Do not include any text outside of the JSON object.
      `;
      
      // Format the conversation
      let conversationText = "";
      messages.forEach(msg => {
        if (msg.role === 'user') {
          conversationText += `Patient: ${msg.content}\n`;
        } else if (msg.role === 'assistant') {
          conversationText += `Doctor: ${msg.content}\n`;
        }
      });
      
      // Create prompt template
      const promptTemplate = PromptTemplate.fromTemplate(
        `${structuredPrompt}\n\nConversation:\n${conversationText}\n\nJSON Analysis:`
      );
      
      // Create LLM chain
      const chain = new LLMChain({
        llm: this.llm,
        prompt: promptTemplate,
        outputParser: new StringOutputParser()
      });
      
      // Get result
      const result = await chain.call({});
      const resultText = result.text || '';
      
      // Try to extract and parse JSON
      try {
        // Look for JSON object in the response
        const jsonMatch = resultText.match(/({[\s\S]*})/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        } else {
          // If no match, try parsing the whole response
          return JSON.parse(resultText);
        }
      } catch (parseError) {
        logger.error(`Failed to parse LangChain JSON output: ${parseError.message}`);
        return {
          canComplete: false,
          missingInformation: ["Unable to analyze due to response format error"]
        };
      }
    } catch (error) {
      logger.error(`LangChain analysis error: ${error.message}`);
      return {
        canComplete: false,
        missingInformation: ["Unable to analyze due to system error"]
      };
    }
  }
  
  /**
   * Create a full conversation chain with memory
   * @returns {ConversationChain} - LangChain conversation chain
   */
  createConversationChain() {
    if (!this.initialized) {
      throw new Error("LangChain adapter not initialized");
    }
    
    return new ConversationChain({
      llm: this.llm,
      memory: this.memory || new BufferMemory(),
      verbose: this.config.verbose || false
    });
  }
}

module.exports = { LangChainAdapter };