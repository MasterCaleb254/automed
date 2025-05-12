// services/triageService.js
const { v4: uuidv4 } = require('uuid');
const llmService = require('./llmService');
const ragService = require('./ragService');
const PatientModel = require('../models/patient');
const TriageResultModel = require('../models/triageResult');

// In-memory session storage (use a database in production)
const activeSessions = new Map();

// Create a new triage session
exports.createSession = async (patientInfo, userId) => {
  // Generate a unique session ID
  const sessionId = uuidv4();
  
  // Initial context for the LLM
  const systemContext = await generateSystemContext(patientInfo);
  
  // Generate initial greeting
  const initialMessage = await llmService.generateResponse(
    systemContext,
    [], // No prior messages yet
    "Introduce yourself as a medical triage AI assistant and ask about the patient's main concern."
  );
  
  // Store session information
  const session = {
    id: sessionId,
    patientId: userId,
    patientInfo,
    messages: [{
      role: 'system',
      content: systemContext
    }, {
      role: 'assistant',
      content: initialMessage
    }],
    createdAt: new Date(),
    lastUpdated: new Date(),
    complete: false,
    triageResult: null
  };
  
  activeSessions.set(sessionId, session);
  
  return {
    id: sessionId,
    initialMessage
  };
};

// Process user message and generate a response
exports.processUserMessage = async (sessionId, message) => {
  // Get the session
  const session = activeSessions.get(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }
  
  // Add user message to the conversation
  session.messages.push({
    role: 'user',
    content: message
  });
  
  // Retrieve relevant medical information using RAG
  const relevantInfo = await ragService.retrieveRelevantMedicalInfo(message, session.messages);
  
  // Generate prompt with retrieved information
  const enhancedSystemContext = `${session.messages[0].content}\n\nRelevant medical information: ${relevantInfo}`;
  
  // Update system message with enhanced context
  session.messages[0].content = enhancedSystemContext;
  
  // Generate LLM response
  const response = await llmService.generateResponse(
    enhancedSystemContext,
    session.messages.slice(1), // All messages except system context
    null // No specific instruction for continuation
  );
  
  // Analyze if triage can be completed
  const analysisResult = await analyzeForTriageCompletion(session.messages);
  
  // Add assistant response to conversation
  session.messages.push({
    role: 'assistant',
    content: response
  });
  
  // Update session timestamp
  session.lastUpdated = new Date();
  
  // Check if triage is complete
  if (analysisResult.canComplete) {
    session.complete = true;
    session.triageResult = analysisResult.result;
    
    // Store result in database
    await saveTriage(session);
    
    // Return result with the response
    return {
      message: response,
      triageComplete: true,
      urgencyLevel: analysisResult.result.urgencyLevel,
      recommendedAction: analysisResult.result.recommendedAction
    };
  }
  
  return {
    message: response,
    triageComplete: false
  };
};

// Get final triage result
exports.getTriageResult = async (sessionId) => {
  const session = activeSessions.get(sessionId);
  
  if (!session || !session.complete) {
    return null;
  }
  
  return session.triageResult;
};

// Get patient's triage history
exports.getPatientTriageHistory = async (patientId) => {
  // This would typically retrieve from your database
  return await TriageResultModel.findByPatientId(patientId);
};

// Helper functions
async function generateSystemContext(patientInfo) {
  // Create a detailed system context based on patient info
  return `You are AutoMed, an advanced medical triage AI assistant. Your role is to assess patient symptoms and determine the appropriate level of care needed.
  
Patient Information:
- Name: ${patientInfo.name}
- Age: ${patientInfo.age}
- Gender: ${patientInfo.gender}
- Medical History: ${patientInfo.medicalHistory || 'None provided'}

Guidelines:
1. Ask clear, relevant questions about symptoms
2. Be empathetic but professional
3. Prioritize patient safety above all
4. Classify urgency into one of these categories: Emergency, Urgent, Semi-urgent, Non-urgent
5. Recommend appropriate actions based on urgency level
6. Do not make definitive diagnoses
7. Recommend emergency services for potentially life-threatening conditions`;
}

async function analyzeForTriageCompletion(messages) {
  // Use LLM to determine if enough information has been gathered
  const analysisPrompt = `Based on the conversation so far, determine if you have enough information to complete the triage process. If yes, provide an urgency assessment and recommended action. If not, what additional information is needed?`;
  
  const analysis = await llmService.generateAnalysis(messages, analysisPrompt);
  
  // Parse the analysis result
  if (analysis.canComplete) {
    return {
      canComplete: true,
      result: {
        urgencyLevel: analysis.urgencyLevel,
        recommendedAction: analysis.recommendedAction,
        reasoning: analysis.reasoning
      }
    };
  }
  
  return {
    canComplete: false,
    missingInformation: analysis.missingInformation
  };
}

async function saveTriage(session) {
  // Save triage results to database
  try {
    const triageRecord = {
      sessionId: session.id,
      patientId: session.patientId,
      conversation: session.messages,
      triageResult: session.triageResult,
      createdAt: session.createdAt,
      completedAt: new Date()
    };
    
    await TriageResultModel.create(triageRecord);
  } catch (error) {
    console.error('Failed to save triage record:', error);
    // Continue without failing the process
  }
}