// Medical Embeddings Utility - JavaScript Implementation
const fs = require('fs').promises;
const path = require('path');
const { pipeline } = require('@xenova/transformers');
const Faiss = require('faiss-node');
const { cosine_similarity } = require('ml-distance');
const { fileURLToPath } = require('url');

/**
 * Utility class for working with medical embeddings for RAG systems.
 * Handles embedding generation, storage, retrieval, and similarity search.
 */
class MedicalEmbeddingsUtility {
  /**
   * Initialize the Medical Embeddings Utility.
   * 
   * @param {Object} config Configuration options
   * @param {string} config.modelName Name of the transformer model to use
   * @param {number} config.embeddingDim Dimension of embeddings
   * @param {string} [config.indexPath] Path to load/save FAISS index
   * @param {string} [config.embeddingsPath] Path to load/save embeddings
   * @param {string} [config.metadataPath] Path to load/save metadata
   */
  constructor({
    modelName = "pritamdeka/S-PubMedBert-MS-MARCO",
    embeddingDim = 768,
    indexPath = null,
    embeddingsPath = null,
    metadataPath = null
  } = {}) {
    this.modelName = modelName;
    this.embeddingDim = embeddingDim;
    this.indexPath = indexPath;
    this.embeddingsPath = embeddingsPath;
    this.metadataPath = metadataPath;
    
    this.model = null;
    this.index = null;
    this.documentEmbeddings = null;
    this.documentMetadata = null;
    
    this.logger = this._setupLogger();
  }

  /**
   * Set up a simple logger
   * @private
   */
  _setupLogger() {
    return {
      info: (message) => console.log(`[INFO] ${new Date().toISOString()} - ${message}`),
      error: (message) => console.error(`[ERROR] ${new Date().toISOString()} - ${message}`),
      warning: (message) => console.warn(`[WARNING] ${new Date().toISOString()} - ${message}`)
    };
  }
  
  /**
   * Initialize the embedding model
   * @returns {Promise<void>}
   */
  async initializeModel() {
    try {
      this.logger.info(`Loading embedding model: ${this.modelName}`);
      // Using the transformers.js pipeline for feature extraction
      this.model = await pipeline('feature-extraction', this.modelName);
      this.logger.info("Model loaded successfully");
    } catch (error) {
      this.logger.error(`Error loading model: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Generate embeddings for a list of text documents.
   * 
   * @param {string[]} texts List of text strings to embed
   * @param {number} [batchSize=32] Batch size for embedding generation
   * @returns {Promise<Float32Array[]>} Array of embeddings
   */
  async embedText(texts, batchSize = 32) {
    if (!this.model) {
      await this.initializeModel();
    }
    
    this.logger.info(`Generating embeddings for ${texts.length} documents`);
    
    try {
      const embeddings = [];
      
      // Process in batches
      for (let i = 0; i < texts.length; i += batchSize) {
        this.logger.info(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(texts.length/batchSize)}`);
        const batch = texts.slice(i, i + batchSize);
        
        // Process each text in the batch
        const batchResults = await Promise.all(
          batch.map(async (text) => {
            const result = await this.model(text, { pooling: 'mean' });
            return Array.from(result.data);
          })
        );
        
        embeddings.push(...batchResults);
      }
      
      this.logger.info(`Generated ${embeddings.length} embeddings`);
      return embeddings;
    } catch (error) {
      this.logger.error(`Error generating embeddings: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Build a FAISS index from embeddings.
   * 
   * @param {number[][]} embeddings Array of embeddings
   * @param {string} [indexType="L2"] Type of FAISS index to build ("L2" or "IP" for inner product)
   * @returns {Object} FAISS index
   */
  buildFaissIndex(embeddings, indexType = "L2") {
    this.logger.info(`Building FAISS index with ${embeddings.length} vectors of dimension ${embeddings[0].length}`);
    
    // Convert to proper format for FAISS
    const embeddingArray = new Float32Array(embeddings.flat());
    
    // Create and setup index
    let index;
    if (indexType === "IP") {
      // Normalize for inner product (equivalent to cosine similarity)
      const normalizedEmbeddings = this._normalizeEmbeddings(embeddings);
      index = new Faiss.IndexFlatIP(this.embeddingDim);
      index.add(new Float32Array(normalizedEmbeddings.flat()));
    } else {
      index = new Faiss.IndexFlatL2(this.embeddingDim);
      index.add(embeddingArray);
    }
    
    this.logger.info(`FAISS index built with ${embeddings.length} vectors`);
    this.index = index;
    
    return index;
  }
  
  /**
   * Normalize embeddings to unit length (for cosine similarity)
   * 
   * @param {number[][]} embeddings Array of embeddings
   * @returns {number[][]} Normalized embeddings
   * @private
   */
  _normalizeEmbeddings(embeddings) {
    return embeddings.map(embedding => {
      const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
      return embedding.map(val => val / norm);
    });
  }
  
  /**
   * Save the FAISS index to disk.
   * 
   * @param {string} [path] Path to save the index to, defaults to this.indexPath
   * @returns {Promise<void>}
   */
  async saveIndex(path = null) {
    if (!this.index) {
      this.logger.warning("No index to save");
      return;
    }
    
    const savePath = path || this.indexPath;
    if (!savePath) {
      this.logger.warning("No path specified for saving index");
      return;
    }
    
    this.logger.info(`Saving FAISS index to ${savePath}`);
    
    try {
      const indexData = this.index.serialize();
      await fs.writeFile(savePath, indexData);
      this.logger.info("Index saved successfully");
    } catch (error) {
      this.logger.error(`Error saving index: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Load a FAISS index from disk.
   * 
   * @param {string} [path] Path to load the index from, defaults to this.indexPath
   * @returns {Promise<Object>} Loaded FAISS index
   */
  async loadIndex(path = null) {
    const loadPath = path || this.indexPath;
    if (!loadPath) {
      this.logger.warning("No path specified for loading index");
      return null;
    }
    
    this.logger.info(`Loading FAISS index from ${loadPath}`);
    
    try {
      const indexData = await fs.readFile(loadPath);
      this.index = Faiss.Index.fromBuffer(indexData);
      this.logger.info("Index loaded successfully");
      return this.index;
    } catch (error) {
      this.logger.error(`Error loading index: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Save embeddings to disk.
   * 
   * @param {number[][]} [embeddings] Embeddings to save, defaults to this.documentEmbeddings
   * @param {string} [path] Path to save embeddings to, defaults to this.embeddingsPath
   * @returns {Promise<void>}
   */
  async saveEmbeddings(embeddings = null, path = null) {
    const embeddingsToSave = embeddings || this.documentEmbeddings;
    if (!embeddingsToSave) {
      this.logger.warning("No embeddings to save");
      return;
    }
    
    const savePath = path || this.embeddingsPath;
    if (!savePath) {
      this.logger.warning("No path specified for saving embeddings");
      return;
    }
    
    this.logger.info(`Saving embeddings to ${savePath}`);
    
    try {
      await fs.writeFile(savePath, JSON.stringify(embeddingsToSave));
      this.logger.info("Embeddings saved successfully");
    } catch (error) {
      this.logger.error(`Error saving embeddings: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Load embeddings from disk.
   * 
   * @param {string} [path] Path to load embeddings from, defaults to this.embeddingsPath
   * @returns {Promise<number[][]>} Loaded embeddings
   */
  async loadEmbeddings(path = null) {
    const loadPath = path || this.embeddingsPath;
    if (!loadPath) {
      this.logger.warning("No path specified for loading embeddings");
      return null;
    }
    
    this.logger.info(`Loading embeddings from ${loadPath}`);
    
    try {
      const data = await fs.readFile(loadPath, 'utf8');
      this.documentEmbeddings = JSON.parse(data);
      this.logger.info(`Embeddings loaded successfully with ${this.documentEmbeddings.length} vectors`);
      return this.documentEmbeddings;
    } catch (error) {
      this.logger.error(`Error loading embeddings: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Save document metadata to disk.
   * 
   * @param {Object[]} [metadata] Metadata to save, defaults to this.documentMetadata
   * @param {string} [path] Path to save metadata to, defaults to this.metadataPath
   * @returns {Promise<void>}
   */
  async saveMetadata(metadata = null, path = null) {
    const metadataToSave = metadata || this.documentMetadata;
    if (!metadataToSave) {
      this.logger.warning("No metadata to save");
      return;
    }
    
    const savePath = path || this.metadataPath;
    if (!savePath) {
      this.logger.warning("No path specified for saving metadata");
      return;
    }
    
    this.logger.info(`Saving metadata to ${savePath}`);
    
    try {
      await fs.writeFile(savePath, JSON.stringify(metadataToSave, null, 2));
      this.logger.info("Metadata saved successfully");
    } catch (error) {
      this.logger.error(`Error saving metadata: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Load document metadata from disk.
   * 
   * @param {string} [path] Path to load metadata from, defaults to this.metadataPath
   * @returns {Promise<Object[]>} Loaded metadata
   */
  async loadMetadata(path = null) {
    const loadPath = path || this.metadataPath;
    if (!loadPath) {
      this.logger.warning("No path specified for loading metadata");
      return null;
    }
    
    this.logger.info(`Loading metadata from ${loadPath}`);
    
    try {
      const data = await fs.readFile(loadPath, 'utf8');
      this.documentMetadata = JSON.parse(data);
      this.logger.info(`Metadata loaded successfully with ${this.documentMetadata.length} entries`);
      return this.documentMetadata;
    } catch (error) {
      this.logger.error(`Error loading metadata: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Process a set of documents: generate embeddings, build index, and store metadata.
   * 
   * @param {string[]} texts List of document texts
   * @param {Object[]} metadata List of metadata objects for each document
   * @param {number} [batchSize=32] Batch size for embedding generation
   * @param {boolean} [save=true] Whether to save the index, embeddings, and metadata to disk
   * @returns {Promise<{embeddings: number[][], index: Object}>} Object containing embeddings and index
   */
  async indexDocuments(texts, metadata, batchSize = 32, save = true) {
    if (texts.length !== metadata.length) {
      throw new Error(`Number of texts (${texts.length}) must match number of metadata entries (${metadata.length})`);
    }
    
    this.logger.info(`Indexing ${texts.length} documents`);
    
    // Generate embeddings
    const embeddings = await this.embedText(texts, batchSize);
    this.documentEmbeddings = embeddings;
    
    // Store metadata
    this.documentMetadata = metadata;
    
    // Build index
    const index = this.buildFaissIndex(embeddings);
    
    // Save if requested
    if (save) {
      if (this.indexPath) {
        await this.saveIndex();
      }
      if (this.embeddingsPath) {
        await this.saveEmbeddings();
      }
      if (this.metadataPath) {
        await this.saveMetadata();
      }
    }
    
    return { embeddings, index };
  }
  
  /**
   * Search for similar documents to a query.
   * 
   * @param {string} query Query text
   * @param {number} [k=5] Number of results to return
   * @param {boolean} [includeDistances=true] Whether to include similarity scores in the results
   * @returns {Promise<Object[]|{results: Object[], distances: number[]}>} Search results
   */
  async search(query, k = 5, includeDistances = true) {
    if (!this.index) {
      this.logger.error("No index available for search");
      throw new Error("Index must be built or loaded before searching");
    }
    
    if (!this.documentMetadata) {
      this.logger.error("No document metadata available for search");
      throw new Error("Document metadata must be available for search");
    }
    
    if (!this.model) {
      await this.initializeModel();
    }
    
    // Generate query embedding
    const queryEmbeddingResult = await this.model(query, { pooling: 'mean' });
    let queryEmbedding = Array.from(queryEmbeddingResult.data);
    
    // Normalize for inner product if using that index type
    if (this.index instanceof Faiss.IndexFlatIP) {
      const norm = Math.sqrt(queryEmbedding.reduce((sum, val) => sum + val * val, 0));
      queryEmbedding = queryEmbedding.map(val => val / norm);
    }
    
    // Search the index
    const searchResults = this.index.search(new Float32Array(queryEmbedding), k);
    const { ids, distances } = searchResults;
    
    // Format results
    const results = [];
    for (let i = 0; i < ids.length; i++) {
      const idx = ids[i];
      if (idx >= 0 && idx < this.documentMetadata.length) {
        const result = { ...this.documentMetadata[idx] };
        if (includeDistances) {
          result.distance = distances[i];
        }
        results.push(result);
      }
    }
    
    if (includeDistances) {
      return { results, distances: Array.from(distances) };
    } else {
      return results;
    }
  }
  
  /**
   * Batch search for similar documents to multiple queries.
   * 
   * @param {string[]} queries List of query texts
   * @param {number} [k=5] Number of results to return for each query
   * @param {number} [batchSize=32] Batch size for embedding generation
   * @param {boolean} [includeDistances=true] Whether to include similarity scores in the results
   * @returns {Promise<Array<Object[]|{results: Object[], distances: number[]}>>} List of search results for each query
   */
  async batchSearch(queries, k = 5, batchSize = 32, includeDistances = true) {
    if (!this.index) {
      this.logger.error("No index available for search");
      throw new Error("Index must be built or loaded before searching");
    }
    
    if (!this.model) {
      await this.initializeModel();
    }
    
    // Generate query embeddings
    const queryEmbeddings = await this.embedText(queries, batchSize);
    
    // Process each query
    const allResults = [];
    for (let i = 0; i < queries.length; i++) {
      let queryEmbedding = queryEmbeddings[i];
      
      // Normalize for inner product if using that index type
      if (this.index instanceof Faiss.IndexFlatIP) {
        const norm = Math.sqrt(queryEmbedding.reduce((sum, val) => sum + val * val, 0));
        queryEmbedding = queryEmbedding.map(val => val / norm);
      }
      
      // Search the index
      const searchResults = this.index.search(new Float32Array(queryEmbedding), k);
      const { ids, distances } = searchResults;
      
      // Format results
      const results = [];
      for (let j = 0; j < ids.length; j++) {
        const idx = ids[j];
        if (idx >= 0 && idx < this.documentMetadata.length) {
          const result = { ...this.documentMetadata[idx] };
          if (includeDistances) {
            result.distance = distances[j];
          }
          results.push(result);
        }
      }
      
      if (includeDistances) {
        allResults.push({ results, distances: Array.from(distances) });
      } else {
        allResults.push(results);
      }
    }
    
    return allResults;
  }
  
  /**
   * Update the index with new documents without rebuilding the entire index.
   * 
   * @param {string[]} newTexts List of new document texts
   * @param {Object[]} newMetadata List of metadata objects for each new document
   * @param {number} [batchSize=32] Batch size for embedding generation
   * @returns {Promise<void>}
   */
  async updateIndex(newTexts, newMetadata, batchSize = 32) {
    if (newTexts.length !== newMetadata.length) {
      throw new Error(`Number of texts (${newTexts.length}) must match number of metadata entries (${newMetadata.length})`);
    }
    
    this.logger.info(`Updating index with ${newTexts.length} new documents`);
    
    // Generate embeddings for new texts
    const newEmbeddings = await this.embedText(newTexts, batchSize);
    
    // Add new embeddings to index
    if (this.index) {
      // Convert to proper format for FAISS
      const embeddingArray = new Float32Array(newEmbeddings.flat());
      
      if (this.index instanceof Faiss.IndexFlatIP) {
        // Normalize for inner product
        const normalizedEmbeddings = this._normalizeEmbeddings(newEmbeddings);
        this.index.add(new Float32Array(normalizedEmbeddings.flat()));
      } else {
        this.index.add(embeddingArray);
      }
      
      this.logger.info(`Index updated, now contains ${this.documentMetadata.length + newMetadata.length} vectors`);
    } else {
      this.logger.info("Creating new index");
      this.buildFaissIndex(newEmbeddings);
    }
    
    // Update stored embeddings
    if (this.documentEmbeddings) {
      this.documentEmbeddings = [...this.documentEmbeddings, ...newEmbeddings];
    } else {
      this.documentEmbeddings = newEmbeddings;
    }
    
    // Update stored metadata
    if (this.documentMetadata) {
      this.documentMetadata = [...this.documentMetadata, ...newMetadata];
    } else {
      this.documentMetadata = newMetadata;
    }
    
    // Save updated data
    if (this.indexPath) {
      await this.saveIndex();
    }
    if (this.embeddingsPath) {
      await this.saveEmbeddings();
    }
    if (this.metadataPath) {
      await this.saveMetadata();
    }
  }
  
  /**
   * Remove documents from the index.
   * Note: FAISS doesn't support direct removal. This implementation rebuilds the index.
   * 
   * @param {number[]} indicesToRemove List of indices to remove from the index
   * @returns {Promise<void>}
   */
  async removeDocuments(indicesToRemove) {
    if (!this.documentEmbeddings || !this.documentMetadata) {
      this.logger.error("No documents to remove");
      return;
    }
    
    this.logger.info(`Removing ${indicesToRemove.length} documents from index`);
    
    // Create array of indices to keep
    const keepIndices = Array.from(
      { length: this.documentMetadata.length }, 
      (_, i) => !indicesToRemove.includes(i)
    );
    
    // Filter embeddings and metadata
    const filteredEmbeddings = this.documentEmbeddings.filter((_, i) => keepIndices[i]);
    const filteredMetadata = this.documentMetadata.filter((_, i) => keepIndices[i]);
    
    // Rebuild index
    this.documentEmbeddings = filteredEmbeddings;
    this.documentMetadata = filteredMetadata;
    this.buildFaissIndex(filteredEmbeddings);
    
    this.logger.info(`Index rebuilt with ${filteredMetadata.length} documents`);
    
    // Save updated data
    if (this.indexPath) {
      await this.saveIndex();
    }
    if (this.embeddingsPath) {
      await this.saveEmbeddings();
    }
    if (this.metadataPath) {
      await this.saveMetadata();
    }
  }
  
  /**
   * Get relevant medical context for a given query.
   * This is a specialized version of search meant for medical RAG applications.
   * 
   * @param {string} query Medical query
   * @param {number} [k=5] Number of results to return
   * @param {boolean} [formatOutput=true] If true, returns a formatted string; otherwise, returns raw results
   * @param {Function} [filterFn=null] Optional function to filter results based on metadata
   * @returns {Promise<string|Object[]>} Formatted context string or raw results
   */
  async getMedicalContext(query, k = 5, formatOutput = true, filterFn = null) {
    const searchResult = await this.search(query, filterFn ? k * 2 : k, true);
    let results = searchResult.results;
    const distances = searchResult.distances;
    
    // Apply filter if provided
    if (filterFn) {
      results = results.filter(filterFn).slice(0, k);
    }
    
    if (!formatOutput) {
      return results;
    }
    
    // Format results into a context string
    let context = `--- MEDICAL CONTEXT FOR: ${query} ---\n\n`;
    
    for (let i = 0; i < Math.min(results.length, k); i++) {
      const result = results[i];
      
      // Extract content and metadata fields
      const content = result.content || result.text || 'No content available';
      const source = result.source || 'Unknown source';
      const docType = result.type || 'Unknown type';
      const relevance = 1.0 - Math.min(Math.max(result.distance || 0, 0), 1.0);  // Convert distance to relevance score
      
      // Format a segment of context
      context += `[DOCUMENT ${i+1}] ${source} (${docType}) - Relevance: ${relevance.toFixed(2)}\n`;
      context += `${content}\n\n`;
    }
    
    return context;
  }
  
  /**
   * Analyze the quality of the embeddings by examining various metrics.
   * 
   * @param {number} [sampleSize=100] Number of sample pairs to check for similarity distribution
   * @returns {Promise<Object>} Dictionary with quality metrics
   */
  async analyzeEmbeddingQuality(sampleSize = 100) {
    if (!this.documentEmbeddings || this.documentEmbeddings.length < 2) {
      this.logger.error("Not enough embeddings for quality analysis");
      return { error: "Not enough embeddings for analysis" };
    }
    
    this.logger.info(`Analyzing embedding quality with ${this.documentEmbeddings.length} vectors`);
    
    // Compute statistics on embedding norms
    const norms = this.documentEmbeddings.map(emb => {
      return Math.sqrt(emb.reduce((sum, val) => sum + val * val, 0));
    });
    
    // Sample random pairs to compute similarity distribution
    const nDocs = this.documentEmbeddings.length;
    const actualSampleSize = Math.min(sampleSize, nDocs * (nDocs - 1) / 2);
    
    const similarities = [];
    for (let s = 0; s < actualSampleSize; s++) {
      // Pick two different random indices
      let i = Math.floor(Math.random() * nDocs);
      let j = Math.floor(Math.random() * (nDocs - 1));
      if (j >= i) j++; // Ensure i != j
      
      // Calculate cosine similarity
      const sim = this._cosineSimilarity(this.documentEmbeddings[i], this.documentEmbeddings[j]);
      similarities.push(sim);
    }
    
    // Calculate statistics
    similarities.sort((a, b) => a - b);
    const percentile25 = similarities[Math.floor(similarities.length * 0.25)];
    const percentile50 = similarities[Math.floor(similarities.length * 0.5)];
    const percentile75 = similarities[Math.floor(similarities.length * 0.75)];
    
    return {
      embedding_count: nDocs,
      dimension: this.embeddingDim,
      norm_statistics: {
        min: Math.min(...norms),
        max: Math.max(...norms),
        mean: norms.reduce((a, b) => a + b, 0) / norms.length,
        std: Math.sqrt(
          norms.reduce((sum, val) => {
            const mean = norms.reduce((a, b) => a + b, 0) / norms.length;
            return sum + Math.pow(val - mean, 2);
          }, 0) / norms.length
        )
      },
      similarity_statistics: {
        min: Math.min(...similarities),
        max: Math.max(...similarities),
        mean: similarities.reduce((a, b) => a + b, 0) / similarities.length,
        std: Math.sqrt(
          similarities.reduce((sum, val) => {
            const mean = similarities.reduce((a, b) => a + b, 0) / similarities.length;
            return sum + Math.pow(val - mean, 2);
          }, 0) / similarities.length
        ),
        percentiles: {
          "25%": percentile25,
          "50%": percentile50,
          "75%": percentile75
        }
      }
    };
  }
  
  /**
   * Calculate cosine similarity between two vectors
   * 
   * @param {number[]} vec1 First vector
   * @param {number[]} vec2 Second vector
   * @returns {number} Cosine similarity
   * @private
   */
  _cosineSimilarity(vec1, vec2) {
    // Dot product
    let dotProduct = 0;
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
    }
    
    // Magnitudes
    const mag1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
    const mag2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));
    
    // Cosine similarity
    if (mag1 === 0 || mag2 === 0) return 0;
    return dotProduct / (mag1 * mag2);
  }
}

module.exports = MedicalEmbeddingsUtility;

// Example usage
async function runExample() {
  try {
    // Initialize the utility
    const embeddingsUtil = new MedicalEmbeddingsUtility({
      modelName: "pritamdeka/S-PubMedBert-MS-MARCO",
      indexPath: "data/medical_index.faiss",
      embeddingsPath: "data/medical_embeddings.json",
      metadataPath: "data/medical_metadata.json"
    });
    
    // Example documents (in practice, these might be loaded from a database)
    const exampleTexts = [
      "Patients with diabetes often experience symptoms such as increased thirst, frequent urination, and fatigue.",
      "Hypertension is a condition characterized by elevated blood pressure, which can lead to heart disease.",
      "Asthma is a chronic inflammatory disease of the airways characterized by recurrent wheezing and shortness of breath.",
      "Stroke is a medical emergency that occurs when blood flow to the brain is interrupted, causing brain cells to die.",
      "COPD, or chronic obstructive pulmonary disease, is a progressive lung disease that makes it difficult to breathe."
    ];
    
    const exampleMetadata = [
      { id: "1", source: "Medical Encyclopedia", type: "condition", specialty: "endocrinology" },
      { id: "2", source: "Medical Encyclopedia", type: "condition", specialty: "cardiology" },
      { id: "3", source: "Medical Encyclopedia", type: "condition", specialty: "pulmonology" },
      { id: "4", source: "Medical Encyclopedia", type: "emergency", specialty: "neurology" },
      { id: "5", source: "Medical Encyclopedia", type: "condition", specialty: "pulmonology" }
    ];
    
    // Index the documents
    await embeddingsUtil.indexDocuments(exampleTexts, exampleMetadata, 2, true);
    
    // Perform a search
    const query = "What are the symptoms of respiratory diseases?";
    const results = await embeddingsUtil.getMedicalContext(query, 3);
        console.log(results);
      } catch (error) {
        console.error("Error in runExample:", error);
      }
    }
    
    runExample();
    // Analyze embedding quality
  const qualityMetrics = await embeddingsUtil.analyzeEmbeddingQuality();
  console.log(JSON.stringify(qualityMetrics, null, 2));


runExample(); // Ensure this function call is outside of any other function or block

// Only run if directly executed (not imported)
if (require.main === module) {
  runExample();
}

/**
 * MedicalRAGSystem class - integrates the embeddings utility with a retrieval augmented generation system.
 * This extends the basic embeddings functionality for medical document retrieval.
 */
class MedicalRAGSystem {
  /**
   * Initialize the Medical RAG System.
   * 
   * @param {Object} config Configuration options
   * @param {MedicalEmbeddingsUtility} config.embeddingsUtil Medical embeddings utility instance
   * @param {Object} config.llmClient LLM client for text generation
   * @param {Object} [config.options] Additional options
   */
  constructor({
    embeddingsUtil,
    llmClient,
    options = {}
  }) {
    this.embeddingsUtil = embeddingsUtil;
    this.llmClient = llmClient;
    this.options = {
      maxContextLength: 4000,
      relevanceThreshold: 0.7,
      ...options
    };
    
    this.logger = this._setupLogger();
  }
  
  /**
   * Set up a simple logger
   * @private
   */
  _setupLogger() {
    return {
      info: (message) => console.log(`[INFO] ${new Date().toISOString()} - ${message}`),
      error: (message) => console.error(`[ERROR] ${new Date().toISOString()} - ${message}`),
      warning: (message) => console.warn(`[WARNING] ${new Date().toISOString()} - ${message}`)
    };
  }
  
  /**
   * Generate a prompt for the LLM with retrieved context.
   * 
   * @param {string} query User query
   * @param {Object[]} retrievedDocs Retrieved documents
   * @returns {string} Formatted prompt
   * @private
   */
  _generatePrompt(query, retrievedDocs) {
    let prompt = `You are a highly knowledgeable medical assistant helping to respond to a medical question. 
Use the provided medical reference information to answer the question accurately and thoroughly.

--- MEDICAL REFERENCES ---\n`;
    
    for (let i = 0; i < retrievedDocs.length; i++) {
      const doc = retrievedDocs[i];
      const content = doc.content || doc.text || 'No content available';
      const source = doc.source || 'Unknown';
      
      prompt += `[REFERENCE ${i+1}] ${source}:\n${content}\n\n`;
    }
    
    prompt += `--- USER QUESTION ---\n${query}\n\n`;
    prompt += `--- YOUR RESPONSE ---\n`;
    prompt += `Please provide a clear, accurate answer based on the medical references provided. 
If the references don't contain enough information to fully answer the question, acknowledge the limitations while providing the best possible answer from what's available.`;
    
    return prompt;
  }
  
  /**
   * Truncate context to fit within the maximum context length.
   * 
   * @param {Object[]} docs Retrieved documents
   * @param {number} maxLength Maximum combined length
   * @returns {Object[]} Truncated documents
   * @private
   */
  _truncateContext(docs, maxLength) {
    let totalLength = 0;
    const truncatedDocs = [];
    
    for (const doc of docs) {
      const content = doc.content || doc.text || '';
      const contentLength = content.length;
      
      if (totalLength + contentLength <= maxLength) {
        truncatedDocs.push(doc);
        totalLength += contentLength;
      } else {
        // Calculate how much text we can include
        const remainingSpace = maxLength - totalLength;
        if (remainingSpace > 100) {  // Only include if we can add something substantial
          const truncatedDoc = { ...doc };
          truncatedDoc.content = content.substring(0, remainingSpace);
          truncatedDoc.truncated = true;
          truncatedDocs.push(truncatedDoc);
        }
        break;
      }
    }
    
    return truncatedDocs;
  }
  
  /**
   * Process a medical query through the RAG system.
   * 
   * @param {string} query User's medical query
   * @param {Object} [options] Processing options
   * @param {number} [options.k=5] Number of documents to retrieve
   * @param {Function} [options.filterFn] Function to filter retrieved documents
   * @param {boolean} [options.includeMetadata=false] Whether to include document metadata in response
   * @returns {Promise<Object>} RAG response with answer and context
   */
  async processQuery(query, { k = 5, filterFn = null, includeMetadata = false } = {}) {
    try {
      this.logger.info(`Processing medical query: "${query}"`);
      
      // Retrieve relevant documents
      const searchResults = await this.embeddingsUtil.search(
        query, 
        filterFn ? k * 2 : k, 
        true
      );
      
      let retrievedDocs = searchResults.results;
      
      // Apply filter if provided
      if (filterFn) {
        retrievedDocs = retrievedDocs.filter(filterFn).slice(0, k);
      }
      
      // Filter by relevance threshold
      retrievedDocs = retrievedDocs.filter(doc => {
        const relevance = 1.0 - Math.min(Math.max(doc.distance || 0, 0), 1.0);
        return relevance >= this.options.relevanceThreshold;
      });
      
      this.logger.info(`Retrieved ${retrievedDocs.length} relevant documents`);
      
      // Truncate context if needed
      const truncatedDocs = this._truncateContext(
        retrievedDocs, 
        this.options.maxContextLength
      );
      
      // Generate prompt with context
      const prompt = this._generatePrompt(query, truncatedDocs);
      
      // Call LLM for answer generation
      this.logger.info("Calling LLM for answer generation");
      const llmResponse = await this.llmClient.generateText(prompt);
      
      // Prepare response
      const response = {
        query,
        answer: llmResponse,
        contextCount: truncatedDocs.length
      };
      
      // Include metadata if requested
      if (includeMetadata) {
        response.context = truncatedDocs.map(doc => {
          const { content, text, ...metadata } = doc;
          return {
            ...metadata,
            contentPreview: (content || text || '').substring(0, 100) + '...'
          };
        });
      }
      
      return response;
    } catch (error) {
      this.logger.error(`Error processing query: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Parse medical entity types from a query.
   * This helps in better understanding the medical intent.
   * 
   * @param {string} query Medical query
   * @returns {Promise<Object>} Extracted entities and their types
   */
  async extractMedicalEntities(query) {
    try {
      // In a production system, this would connect to a medical NER model
      // For this implementation, we'll use a simplified approach
      
      // Common medical entity categories
      const entityCategories = {
        symptoms: [
          "pain", "fever", "cough", "headache", "fatigue", "nausea", "vomiting",
          "dizziness", "shortness of breath", "chest pain", "rash", "swelling"
        ],
        conditions: [
          "diabetes", "hypertension", "asthma", "cancer", "arthritis", "depression",
          "anxiety", "obesity", "coronary", "heart disease", "stroke", "alzheimer",
          "copd", "pneumonia", "flu", "covid"
        ],
        medications: [
          "aspirin", "ibuprofen", "acetaminophen", "insulin", "antibiotic",
          "antidepressant", "statin", "metformin", "lisinopril", "vaccine"
        ],
        bodyParts: [
          "head", "chest", "abdomen", "arm", "leg", "heart", "lung", "liver",
          "kidney", "brain", "throat", "ear", "eye", "skin", "joint"
        ]
      };
      
      const result = {
        entities: {},
        primaryEntityType: null
      };
      
      // Search for each category of entities
      Object.keys(entityCategories).forEach(category => {
        const found = [];
        entityCategories[category].forEach(entity => {
          const regex = new RegExp(`\\b${entity}\\b`, 'i');
          if (regex.test(query)) {
            found.push(entity);
          }
        });
        
        if (found.length > 0) {
          result.entities[category] = found;
        }
      });
      
      // Determine primary entity type based on count
      let maxCount = 0;
      Object.keys(result.entities).forEach(type => {
        if (result.entities[type].length > maxCount) {
          maxCount = result.entities[type].length;
          result.primaryEntityType = type;
        }
      });
      
      return result;
    } catch (error) {
      this.logger.error(`Error extracting medical entities: ${error.message}`);
      return { entities: {}, primaryEntityType: null };
    }
  }
  
  /**
   * Expand a medical query with relevant medical terminology.
   * 
   * @param {string} query Original query
   * @returns {Promise<string>} Expanded query
   */
  async expandMedicalQuery(query) {
    try {
      // Extract medical entities
      const entityResult = await this.extractMedicalEntities(query);
      
      // In a production system, this would use a medical knowledge graph
      // For this implementation, we'll use a simplified approach with common expansions
      
      const expansions = {
        symptoms: {
          "pain": ["discomfort", "ache", "soreness"],
          "headache": ["migraine", "head pain", "cephalgia"],
          "fatigue": ["tiredness", "exhaustion", "lethargy"],
          "cough": ["expectoration", "hacking", "wheezing"]
        },
        conditions: {
          "diabetes": ["diabetes mellitus", "hyperglycemia", "insulin resistance"],
          "hypertension": ["high blood pressure", "elevated BP", "HTN"],
          "asthma": ["reactive airway disease", "bronchial asthma", "wheezing"],
          "covid": ["coronavirus", "SARS-CoV-2", "COVID-19"]
        }
      };
      
      let expandedQuery = query;
      
      // Add expansions for found entities
      Object.keys(entityResult.entities).forEach(category => {
        if (expansions[category]) {
          entityResult.entities[category].forEach(entity => {
            if (expansions[category][entity]) {
              const terms = expansions[category][entity];
              // Avoid adding terms that are already in the query
              const newTerms = terms.filter(term => !query.toLowerCase().includes(term.toLowerCase()));
              
              if (newTerms.length > 0) {
                expandedQuery += ` (also consider: ${newTerms.join(", ")})`;
              }
            }
          });
        }
      });
      
      return expandedQuery;
    } catch (error) {
      this.logger.error(`Error expanding medical query: ${error.message}`);
      return query; // Return original query if expansion fails
    }
  }
  
  /**
   * Process a medical triage request.
   * This is a specialized version for medical triage that includes urgency assessment.
   * 
   * @param {string} symptoms Description of symptoms
   * @param {Object} patientInfo Basic patient information
   * @param {Object} [options] Processing options
   * @returns {Promise<Object>} Triage response with urgency level and recommendations
   */
  async processTriage(symptoms, patientInfo, options = {}) {
    try {
      this.logger.info(`Processing medical triage for symptoms: "${symptoms}"`);
      
      // Combine symptoms with patient info for context
      const ageInfo = patientInfo.age ? `${patientInfo.age} year old` : "";
      const genderInfo = patientInfo.gender || "";
      const medicalHistory = patientInfo.history ? `with history of ${patientInfo.history}` : "";
      
      const context = `${ageInfo} ${genderInfo} patient ${medicalHistory} presenting with: ${symptoms}`;
      
      // Expand query with medical terminology
      const expandedQuery = await this.expandMedicalQuery(context);
      
      // Retrieve relevant medical information
      const retrievalResults = await this.embeddingsUtil.search(expandedQuery, 7, true);
      let relevantDocs = retrievalResults.results;
      
      // Filter to most relevant documents
      relevantDocs = relevantDocs.filter(doc => {
        const relevance = 1.0 - Math.min(Math.max(doc.distance || 0, 0), 1.0);
        return relevance >= 0.6; // Lower threshold for triage to ensure more coverage
      });
      
      // Truncate context if needed
      const truncatedDocs = this._truncateContext(relevantDocs, this.options.maxContextLength);
      
      // Construct specialized triage prompt
      let triagePrompt = `You are a medical triage assistant helping to assess the urgency of a patient's condition.
Based on the provided patient information and medical reference materials, provide a triage assessment.

--- PATIENT INFORMATION ---
${context}

--- MEDICAL REFERENCES ---\n`;
      
      for (let i = 0; i < truncatedDocs.length; i++) {
        const doc = truncatedDocs[i];
        const content = doc.content || doc.text || 'No content available';
        const source = doc.source || 'Unknown';
        
        triagePrompt += `[REFERENCE ${i+1}] ${source}:\n${content}\n\n`;
      }
      
      triagePrompt += `--- TRIAGE ASSESSMENT ---
Please provide:
1. Urgency level (EMERGENCY, URGENT, SEMI-URGENT, NON-URGENT)
2. Brief assessment of the condition
3. Recommended next steps
4. Any warning signs that would increase the urgency

Base your assessment on the medical references and be cautious when symptoms might indicate a serious condition.`;
      
      // Call LLM for triage assessment
      this.logger.info("Calling LLM for triage assessment");
      const triageResponse = await this.llmClient.generateText(triagePrompt);
      
      // Extract urgency level from response (could be more sophisticated in production)
      let urgencyLevel = "UNKNOWN";
      const urgencyPatterns = {
        EMERGENCY: /\bEMERGENCY\b/i,
        URGENT: /\bURGENT\b/i,
        "SEMI-URGENT": /\bSEMI-URGENT\b/i,
        "NON-URGENT": /\bNON-URGENT\b/i
      };
      
      Object.entries(urgencyPatterns).forEach(([level, pattern]) => {
        if (pattern.test(triageResponse)) {
          urgencyLevel = level;
        }
      });
      
      return {
        query: symptoms,
        patientInfo,
        triageResponse,
        urgencyLevel,
        referenceCount: truncatedDocs.length
      };
    } catch (error) {
      this.logger.error(`Error processing triage: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Add new medical documents to the knowledge base.
   * 
   * @param {Object[]} documents Array of document objects with text and metadata
   * @param {boolean} [reindex=false] Whether to rebuild the index after adding
   * @returns {Promise<Object>} Status of the operation
   */
  async addMedicalDocuments(documents, reindex = false) {
    try {
      // Extract texts and metadata
      const texts = documents.map(doc => doc.content || doc.text);
      const metadata = documents.map(doc => {
        const { content, text, ...meta } = doc;
        return meta;
      });
      
      // Add timestamp if not present
      metadata.forEach(meta => {
        if (!meta.timestamp) {
          meta.timestamp = new Date().toISOString();
        }
      });
      
      if (reindex) {
        // Load existing documents if available
        let existingTexts = [];
        let existingMetadata = [];
        
        if (this.embeddingsUtil.documentEmbeddings && this.embeddingsUtil.documentMetadata) {
          // We need to get the original texts, which requires either:
          // 1. Having them stored separately, or
          // 2. Regenerating them from stored information
          // For this example, let's assume we have the original texts stored
          this.logger.warning("Reindexing requires access to all original texts, which may not be available");
          
          existingTexts = []; // In a real system, retrieve these from storage
          existingMetadata = this.embeddingsUtil.documentMetadata;
        }
        
        // Combine existing and new documents
        const allTexts = [...existingTexts, ...texts];
        const allMetadata = [...existingMetadata, ...metadata];
        
        // Reindex everything
        await this.embeddingsUtil.indexDocuments(allTexts, allMetadata);
        
        return {
          status: "success",
          message: `Reindexed ${allTexts.length} documents (${texts.length} new)`
        };
      } else {
        // Just update with new documents
        await this.embeddingsUtil.updateIndex(texts, metadata);
        
        return {
          status: "success",
          message: `Added ${texts.length} new documents to index`
        };
      }
    } catch (error) {
      this.logger.error(`Error adding medical documents: ${error.message}`);
      return {
        status: "error",
        message: error.message
      };
    }
  }
}

module.exports = { MedicalEmbeddingsUtility, MedicalRAGSystem };