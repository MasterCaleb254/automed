// services/ragService.js
const config = require('../config/llm');
const { ChromaClient } = require('chromadb');
const { Document } = require('langchain/document');
const { OpenAIEmbeddings } = require('langchain/embeddings/openai');
const { HNSWLib } = require('langchain/vectorstores/hnswlib');

// Initialize vector database client
let vectorDb;
let embeddingModel;

// Initialize RAG components based on configuration
async function initializeRAG() {
  if (config.rag.provider === 'chroma') {
    // Initialize Chroma client
    const chromaClient = new ChromaClient({ path: config.rag.dbPath });
    const collection = await chromaClient.getOrCreateCollection({ name: "medical_knowledge" });
    vectorDb = collection;
  } 
  else if (config.rag.provider === 'local') {
    // Use HNSWLib for local vector store
    vectorDb = await HNSWLib.load(config.rag.dbPath);
  }
  
  // Initialize embedding model
  if (config.rag.embeddingProvider === 'openai') {
    embeddingModel = new OpenAIEmbeddings({
      openAIApiKey: config.apiKey,
    });
  }
}

// Ensure initialization before use
let isInitialized = false;
async function ensureInitialized() {
  if (!isInitialized) {
    await initializeRAG();
    isInitialized = true;
  }
}

// Retrieve relevant medical information based on user query and conversation context
exports.retrieveRelevantMedicalInfo = async (query, conversationHistory) => {
  await ensureInitialized();
  
  try {
    // Extract key medical terms from the conversation
    const medicalTerms = await extractMedicalTerms(query, conversationHistory);
    
    // Create a search query combining the current message and extracted terms
    const enhancedQuery = `${query} ${medicalTerms.join(' ')}`;
    
    // Generate embedding for the query
    const queryEmbedding = await embeddingModel.embedQuery(enhancedQuery);
    
    // Search the vector database
    let results;
    if (config.rag.provider === 'chroma') {
      // Chroma search
      results = await vectorDb.query({
        queryEmbeddings: [queryEmbedding],
        nResults: 5
      });
    } 
    else if (config.rag.provider === 'local') {
      // HNSWLib search
      results = await vectorDb.similaritySearch(enhancedQuery, 5);
    }
    
    // Format results for inclusion in the prompt
    const formattedResults = results.map(doc => {
      return `Source: ${doc.metadata.source}\n${doc.pageContent}`;
    }).join('\n\n');
    
    return formattedResults;
  } catch (error) {
    console.error('Error retrieving medical information:', error);
    return ""; // Return empty string on error to avoid blocking the triage process
  }
};

// Helper function to extract medical terms from conversation
async function extractMedicalTerms(query, conversationHistory) {
  // This could use the LLM to extract key medical terms from the conversation
  // For simplicity, we'll use a basic approach here
  const allMessages = conversationHistory.map(msg => msg.content).join(' ') + ' ' + query;
  
  // Use regex to find potential medical terms
  // This is very simplistic - a real implementation would use more sophisticated NLP
  const commonSymptoms = [
    'pain', 'fever', 'cough', 'headache', 'nausea', 'dizzy', 'vomiting',
    'chest', 'breathing', 'shortness', 'breath', 'fatigue', 'weakness',
    'swelling', 'blood', 'pressure', 'diabetes', 'heart', 'cancer',
    'infection', 'allergy', 'medication', 'chronic', 'acute'
  ];
  
  const foundTerms = commonSymptoms.filter(term => 
    new RegExp(`\\b${term}\\b`, 'i').test(allMessages)
  );
  
  return foundTerms;
}

// Export a function to preload medical data (would be called during setup)
exports.preloadMedicalData = async (dataSource) => {
  await ensureInitialized();
  
  // This would load medical data from files or APIs into the vector store
  console.log(`Preloading medical data from ${dataSource}...`);
  
  // Implementation would depend on your data source format
};