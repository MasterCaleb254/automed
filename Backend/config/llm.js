// config/llm.js
require('dotenv').config();

module.exports = {
  // Primary configuration
  provider: process.env.LLM_PROVIDER || 'openai',
  model: process.env.LLM_MODEL || 'gpt-4',
  apiKey: process.env.OPENAI_API_KEY,
  
  // Performance settings
  temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.3'),
  maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '1000'),
  timeout: parseInt(process.env.LLM_TIMEOUT || '30000'),
  maxRetries: parseInt(process.env.LLM_MAX_RETRIES || '3'),
  
  // LangChain specific settings
  langchain: {
    modelType: process.env.LANGCHAIN_MODEL_TYPE || 'openai',
    modelPath: process.env.LANGCHAIN_MODEL_PATH, // For local models
    useMemory: process.env.LANGCHAIN_USE_MEMORY === 'true',
    memoryType: process.env.LANGCHAIN_MEMORY_TYPE || 'buffer',
    verbose: process.env.LANGCHAIN_VERBOSE === 'true'
  },
  
  // RAG configuration
  rag: {
    // Vector DB provider: 'chroma', 'pinecone', or 'local'
    provider: process.env.RAG_PROVIDER || 'chroma',
    
    // Vector DB configuration
    dbPath: process.env.RAG_DB_PATH || './data/vectordb',
    pineconeApiKey: process.env.PINECONE_API_KEY,
    pineconeEnvironment: process.env.PINECONE_ENVIRONMENT,
    pineconeIndex: process.env.PINECONE_INDEX,
    
    // Embedding model configuration
    embeddingProvider: process.env.EMBEDDING_PROVIDER || 'openai',
    embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-ada-002',
    embeddingDimension: parseInt(process.env.EMBEDDING_DIMENSION || '1536'),
    
    // RAG processing
    retrievalDocuments: parseInt(process.env.RAG_RETRIEVAL_DOCS || '5'),
    chunkSize: parseInt(process.env.RAG_CHUNK_SIZE || '1000'),
    chunkOverlap: parseInt(process.env.RAG_CHUNK_OVERLAP || '200')
  },
  
  // Medical triage specific settings
  triage: {
    // Default system prompt
    systemPrompt: process.env.DEFAULT_SYSTEM_PROMPT || `You are AutoMed, a professional medical triage assistant. 
    Your goal is to collect relevant information about the patient's condition 
    in order to determine the appropriate level of medical care needed.
    
    Always be empathetic, accurate, and focus on patient safety.
    Do not make definitive diagnoses.
    Recommend emergency services for any potentially life-threatening conditions.`,
    
    // Urgency levels and actions
    urgencyLevels: ['Emergency', 'Urgent', 'Semi-urgent', 'Non-urgent'],
    
    // Limit of conversation turns before forced assessment
    maxConversationTurns: parseInt(process.env.MAX_CONVERSATION_TURNS || '10')
  },
  
  // Logging and monitoring
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    tokenTracking: process.env.TRACK_TOKENS === 'true'
  }
};
// config/llm.js
require('dotenv').config();

module.exports = {
  // LLM provider: 'openai' or 'langchain'
  provider: process.env.LLM_PROVIDER || 'openai',
  
  // API key for the selected provider
  apiKey: process.env.OPENAI_API_KEY,
  
  // Model to use
  model: process.env.LLM_MODEL || 'gpt-4',
  
  // RAG configuration
  rag: {
    // Vector DB provider: 'chroma' or 'local'
    provider: process.env.RAG_PROVIDER || 'chroma',
    
    // Path to vector database
    dbPath: process.env.RAG_DB_PATH || './data/vectordb',
    
    // Embedding provider: 'openai' or 'local'
    embeddingProvider: process.env.EMBEDDING_PROVIDER || 'openai',
    
    // Embedding model name
    embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-ada-002'
  }
};