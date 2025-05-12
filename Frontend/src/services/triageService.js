// src/services/triageService.js
const apiUrl = process.env.REACT_APP_API_URL;  // Using the environment variable

export const fetchTriageData = async () => {
  const apiUrl = process.env.REACT_APP_API_URL;
  const timeout = 5000;  // 5 seconds timeout
  
  // Create a new promise for the fetch call with timeout
  const fetchPromise = fetch(`${apiUrl}/triage`)
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    });

  // Create a promise that will reject after the timeout
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Request timed out')), timeout)
  );

  // Wait for either the fetch or the timeout, whichever happens first
  try {
    const data = await Promise.race([fetchPromise, timeoutPromise]);
    return data;
  } catch (error) {
    console.error('API Request Failed:', error.message);
    // Handle error UI here (e.g., show error message to user)
  }
};
// src/services/triageService.js

import { api } from './api.js';

/**
 * Mapping for triage urgency levels
 */
export const URGENCY_LEVELS = {
  EMERGENCY: 'emergency',       // Immediate life-threatening conditions
  URGENT: 'urgent',             // Conditions requiring care within 1-2 hours
  SEMI_URGENT: 'semi-urgent',   // Conditions requiring care within 24 hours
  NON_URGENT: 'non-urgent',     // Conditions that can be treated by routine care
};

/**
 * Initialize a new triage session
 * @param {Object} patientData - Initial patient information
 * @returns {Promise} - Promise with triage session details
 */
export const initializeTriageSession = async (patientData) => {
  try {
    return await api.post('triage/sessions', patientData);
  } catch (error) {
    console.error('Failed to initialize triage session:', error);
    
    // Fallback to local processing if API is unavailable
    return mockInitializeSession(patientData);
  }
};

/**
 * Process patient message in triage conversation
 * @param {Array} chatHistory - Array of message objects
 * @param {Object} patientData - Patient information
 * @returns {Promise} - Promise with AI response
 */
export const processTriageMessage = async (chatHistory, patientData) => {
  try {
    const sessionId = localStorage.getItem('triageSessionId');
    
    // If we have a session ID, use it
    if (sessionId) {
      return await api.post(`triage/sessions/${sessionId}/messages`, {
        message: chatHistory[chatHistory.length - 1].content,
        chatHistory
      });
    } else {
      // Otherwise try to initialize a session first
      const session = await initializeTriageSession(patientData);
      localStorage.setItem('triageSessionId', session.sessionId);
      
      return await api.post(`triage/sessions/${session.sessionId}/messages`, {
        message: chatHistory[chatHistory.length - 1].content,
        chatHistory
      });
    }
  } catch (error) {
    console.error('Failed to process triage message:', error);
    
    // Fallback to local processing if API is unavailable
    return mockProcessMessage(chatHistory, patientData);
  }
};

/**
 * Complete a triage session and get final assessment
 * @param {string} sessionId - Triage session ID
 * @returns {Promise} - Promise with final triage results
 */
export const completeTriageSession = async (sessionId = null) => {
  sessionId = sessionId || localStorage.getItem('triageSessionId');
  
  try {
    if (sessionId) {
      const result = await api.post(`triage/sessions/${sessionId}/complete`);
      // Clear the session ID after completion
      localStorage.removeItem('triageSessionId');
      return result;
    } else {
      throw new Error('No active triage session');
    }
  } catch (error) {
    console.error('Failed to complete triage session:', error);
    
    // Fallback to local processing
    return mockCompleteSession();
  }
};

// -------------------------
// Mock implementations for offline development and testing
// -------------------------

/**
 * Mock implementation of session initialization
 * @param {Object} patientData - Patient information 
 */
const mockInitializeSession = (patientData) => {
  // Store patient data in localStorage for our mock implementation
  localStorage.setItem('mockPatientData', JSON.stringify(patientData));
  const sessionId = 'mock-session-' + Date.now();
  localStorage.setItem('triageSessionId', sessionId);
  
  // Analyze chief complaint to determine potential urgency
  const complaintAnalysis = analyzeMockComplaint(patientData.chiefComplaint);
  localStorage.setItem('mockComplaintAnalysis', JSON.stringify(complaintAnalysis));
  
  return Promise.resolve({
    sessionId,
    status: 'initialized',
    message: 'Triage session initialized successfully'
  });
};

/**
 * Mock implementation of message processing
 * @param {Array} chatHistory - Array of message objects
 */
const mockProcessMessage = (chatHistory, patientData) => {
  // Get the last user message
  const lastMessage = chatHistory[chatHistory.length - 1];
  
  // Get stored complaint analysis or create one
  let complaintAnalysis;
  try {
    complaintAnalysis = JSON.parse(localStorage.getItem('mockComplaintAnalysis')) || 
                        analyzeMockComplaint(patientData.chiefComplaint);
  } catch (e) {
    complaintAnalysis = analyzeMockComplaint(patientData.chiefComplaint);
  }
  
  // Check conversation progress
  const conversationTurn = chatHistory.filter(msg => msg.role === 'user').length;
  
  // Simple mock conversation flow
  if (conversationTurn === 1) {
    // First user message - ask about duration
    return Promise.resolve({
      message: `Thank you for sharing that. How long have you been experiencing these symptoms?`,
      complete: false
    });
  } else if (conversationTurn === 2) {
    // Second user message - ask about severity
    return Promise.resolve({
      message: `I understand. On a scale of 1-10, how would you rate the severity of your symptoms?`,
      complete: false
    });
  } else if (conversationTurn === 3) {
    // Third user message - ask about associated symptoms
    return Promise.resolve({
      message: `Are you experiencing any other symptoms along with your ${patientData.chiefComplaint.toLowerCase()}? For example: fever, nausea, dizziness, etc.`,
      complete: false
    });
  } else if (conversationTurn === 4) {
    // Fourth user message - check for red flags
    return Promise.resolve({
      message: `Thank you. Have you experienced any of the following: ${complaintAnalysis.redFlags.join(', ')}?`,
      complete: false
    });
  } else if (conversationTurn === 5) {
    // Fifth user message - complete assessment
    return Promise.resolve({
      message: `I have enough information now to provide you with an assessment. Let me analyze your responses.`,
      complete: true,
      result: generateMockTriageResult(patientData, chatHistory, complaintAnalysis)
    });
  } else {
    // Fallback
    return Promise.resolve({
      message: `I'm processing your information. Can you provide any additional details about your symptoms?`,
      complete: false
    });
  }
};

/**
 * Mock completion of triage session
 */
const mockCompleteSession = () => {
  // Get stored patient data and analysis
  let patientData, complaintAnalysis;
  
  try {
    patientData = JSON.parse(localStorage.getItem('mockPatientData')) || {};
    complaintAnalysis = JSON.parse(localStorage.getItem('mockComplaintAnalysis')) || {};
  } catch (e) {
    patientData = {};
    complaintAnalysis = { potentialUrgency: URGENCY_LEVELS.NON_URGENT };
  }
  
  // Clean up localStorage
  localStorage.removeItem('mockPatientData');
  localStorage.removeItem('mockComplaintAnalysis');
  localStorage.removeItem('triageSessionId');
  
  // Generate mock result
  return Promise.resolve(generateMockTriageResult(patientData, [], complaintAnalysis));
};

/**
 * Analyze chief complaint to get potential questions and urgency
 * @param {string} complaint - Chief complaint
 * @returns {Object} - Analysis object
 */
const analyzeMockComplaint = (complaint) => {
  const complaintLower = complaint.toLowerCase();
  
  // Check for emergency keywords
  if (complaintLower.includes('chest pain') || 
      complaintLower.includes('difficulty breathing') ||
      complaintLower.includes('severe bleeding') ||
      complaintLower.includes('unconscious')) {
    return {
      potentialUrgency: URGENCY_LEVELS.EMERGENCY,
      redFlags: [
        'severe chest pain', 
        'difficulty breathing', 
        'loss of consciousness', 
        'bluish lips or face'
      ],
      followUpQuestions: [
        'Is the pain radiating to your arm, jaw, or back?',
        'Are you experiencing shortness of breath?',
        'Are you sweating more than usual?',
        'Do you feel lightheaded or dizzy?'
      ]
    };
  }
  
  // Check for urgent keywords
  else if (complaintLower.includes('fever') || 
           complaintLower.includes('vomiting') ||
           complaintLower.includes('headache')) {
    return {
      potentialUrgency: URGENCY_LEVELS.URGENT,
      redFlags: [
        'high fever above 103°F/39.4°C', 
        'stiff neck', 
        'severe vomiting', 
        'inability to keep fluids down'
      ],
      followUpQuestions: [
        'How high is your fever?',
        'Have you been able to keep fluids down?',
        'Do you have sensitivity to light?',
        'Have you taken any medications for your symptoms?'
      ]
    };
  }
  
  // Check for semi-urgent keywords
  else if (complaintLower.includes('ear') || 
           complaintLower.includes('throat') ||
           complaintLower.includes('rash')) {
    return {
      potentialUrgency: URGENCY_LEVELS.SEMI_URGENT,
      redFlags: [
        'spreading rash', 
        'severe ear pain', 
        'difficulty swallowing', 
        'voice changes'
      ],
      followUpQuestions: [
        'Is the pain constant or does it come and go?',
        'Have you noticed any discharge?',
        'Have you had a fever with these symptoms?',
        'Have you tried any over-the-counter medications?'
      ]
    };
  }
  
  // Default non-urgent
  else {
    return {
      potentialUrgency: URGENCY_LEVELS.NON_URGENT,
      redFlags: [
        'worsening symptoms', 
        'symptoms lasting more than a week', 
        'affected daily activities'
      ],
      followUpQuestions: [
        'How long have you been experiencing these symptoms?',
        'Have the symptoms been getting better, worse, or staying the same?',
        'Have you tried any treatments already?',
        'Do your symptoms affect your daily activities?'
      ]
    };
  }
};

/**
 * Generate a mock triage result based on patient data and history
 * @param {Object} patientData - Patient information
 * @param {Array} chatHistory - Array of message objects
 * @param {Object} complaintAnalysis - Analysis of chief complaint
 * @returns {Object} - Triage result
 */
const generateMockTriageResult = (patientData, chatHistory, complaintAnalysis) => {
  // Get potential urgency from analysis
  let urgencyLevel = complaintAnalysis.potentialUrgency || URGENCY_LEVELS.NON_URGENT;
  
  // Check chat history for red flags (basic check)
  if (chatHistory && chatHistory.length) {
    const userMessages = chatHistory
      .filter(msg => msg.role === 'user')
      .map(msg => msg.content.toLowerCase());
    
    // Check for emergency indicators in user messages
    const hasEmergencyWords = userMessages.some(msg => 
      msg.includes('severe') || 
      msg.includes('excruciating') || 
      msg.includes('worst') ||
      msg.includes('can\'t breathe') ||
      msg.includes('10 out of 10')
    );
    
    // Upgrade urgency if emergency words found
    if (hasEmergencyWords && urgencyLevel !== URGENCY_LEVELS.EMERGENCY) {
      urgencyLevel = URGENCY_LEVELS.URGENT;
    }
    
    // Check for red flags
    const redFlagsMentioned = complaintAnalysis.redFlags?.some(flag => 
      userMessages.some(msg => msg.includes(flag.toLowerCase()))
    );
    
    // Upgrade urgency if red flags found
    if (redFlagsMentioned) {
      if (urgencyLevel === URGENCY_LEVELS.NON_URGENT) {
        urgencyLevel = URGENCY_LEVELS.SEMI_URGENT;
      } else if (urgencyLevel === URGENCY_LEVELS.SEMI_URGENT) {
        urgencyLevel = URGENCY_LEVELS.URGENT;
      }
    }
  }
  
  // Generate result based on urgency level
  return {
    urgencyLevel,
    recommendation: getRecommendationByUrgency(urgencyLevel),
    warnings: getWarningsByUrgency(urgencyLevel, patientData),
    nextSteps: getNextStepsByUrgency(urgencyLevel, patientData)
  };
};

/**
 * Get recommendation text based on urgency level
 * @param {string} urgencyLevel - Urgency level
 * @returns {string} - Recommendation text
 */
const getRecommendationByUrgency = (urgencyLevel) => {
  switch (urgencyLevel) {
    case URGENCY_LEVELS.EMERGENCY:
      return 'Based on the information provided, you may be experiencing a medical emergency. Please call emergency services (911) immediately or go to the nearest emergency room.';
    case URGENCY_LEVELS.URGENT:
      return 'Your symptoms require prompt medical attention. Please visit an urgent care center or emergency room within the next 1-2 hours.';
    case URGENCY_LEVELS.SEMI_URGENT:
      return 'Your condition should be evaluated by a healthcare provider. Please schedule an appointment with your doctor within the next 24 hours or visit an urgent care center if your symptoms worsen.';
    case URGENCY_LEVELS.NON_URGENT:
      return 'Your symptoms can likely be managed with home care or through a routine appointment with your primary care provider. Please schedule a regular appointment in the next few days.';
    default:
      return 'Please consult with a healthcare provider to evaluate your symptoms.';
  }
};

/**
 * Get warning messages based on urgency level
 * @param {string} urgencyLevel - Urgency level
 * @param {Object} patientData - Patient information
 * @returns {Array} - Array of warning messages
 */
const getWarningsByUrgency = (urgencyLevel, patientData) => {
  const warnings = [];
  
  // Common warnings for all urgency levels
  warnings.push('This is an automated assessment and not a medical diagnosis.');
  
  // Specific warnings based on urgency level
  switch (urgencyLevel) {
    case URGENCY_LEVELS.EMERGENCY:
      warnings.push('Do not drive yourself if you are experiencing severe symptoms.');
      warnings.push('Call emergency services (911) immediately.');
      break;
    case URGENCY_LEVELS.URGENT:
      warnings.push('If your symptoms worsen, call emergency services (911).');
      break;
    case URGENCY_LEVELS.SEMI_URGENT:
      warnings.push('If your symptoms suddenly worsen, seek immediate medical attention.');
      break;
    case URGENCY_LEVELS.NON_URGENT:
      warnings.push('Monitor your symptoms. If they worsen or persist, contact your healthcare provider.');
      break;
  }
  
  // Age-specific warnings
  const age = parseInt(patientData.age);
  if (!isNaN(age)) {
    if (age < 2 && (urgencyLevel === URGENCY_LEVELS.URGENT || urgencyLevel === URGENCY_LEVELS.SEMI_URGENT)) {
      warnings.push('Young children can deteriorate quickly. Monitor them closely for any changes.');
    } else if (age > 65) {
      warnings.push('Older adults may have atypical presentations of serious conditions. Consider seeking medical attention even for mild symptoms.');
    }
  }
  
  return warnings;
};

/**
 * Get next steps based on urgency level
 * @param {string} urgencyLevel - Urgency level
 * @param {Object} patientData - Patient information
 * @returns {Array} - Array of next step instructions
 */
const getNextStepsByUrgency = (urgencyLevel, patientData) => {
  switch (urgencyLevel) {
    case URGENCY_LEVELS.EMERGENCY:
      return [
        'Call emergency services (911) immediately.',
        'Do not eat or drink anything until evaluated by medical professionals.',
        'If you have prescribed emergency medications (like nitroglycerin for chest pain), take them as prescribed.',
        'Stay calm and wait for emergency services to arrive.'
      ];
    case URGENCY_LEVELS.URGENT:
      return [
        'Go to the nearest urgent care center or emergency room within the next 1-2 hours.',
        'If possible, bring a list of your current medications.',
        'If symptoms worsen before you arrive, call emergency services.',
        'Arrange for someone else to drive you if possible.'
      ];
    case URGENCY_LEVELS.SEMI_URGENT:
      return [
        'Contact your doctor to schedule an appointment within the next 24 hours.',
        'Monitor your symptoms closely and keep a log of any changes.',
        'Take over-the-counter medications as appropriate for symptom relief.',
        'Rest and stay hydrated.',
        'If symptoms worsen, seek more immediate medical attention.'
      ];
    case URGENCY_LEVELS.NON_URGENT:
      return [
        'Schedule a routine appointment with your primary care provider.',
        'Try appropriate home care measures for your symptoms.',
        'Rest and ensure adequate hydration.',
        'Take over-the-counter medications as appropriate for symptom relief.',
        'If symptoms persist beyond 7-10 days or worsen, follow up with your healthcare provider.'
      ];
    default:
      return [
        'Monitor your symptoms closely.',
        'Contact your healthcare provider if you have concerns.',
        'Ensure you\'re getting adequate rest and hydration.'
      ];
  }
};
