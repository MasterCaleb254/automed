// src/services/medicalKnowledgeService.js
import { api } from './api';

/**
 * Service for medical knowledge retrieval and RAG functionality
 */

/**
 * Get relevant medical information for a given query
 * @param {string} query - The medical query
 * @param {Object} context - Additional context (patient info, etc.)
 * @returns {Promise} - Promise with medical information
 */
export const getMedicalInformation = async (query, context = {}) => {
  try {
    return await api.post('knowledge/retrieve', {
      query,
      context
    });
  } catch (error) {
    console.error('Failed to retrieve medical information:', error);
    // Fallback to local knowledge if available
    return getLocalMedicalInformation(query, context);
  }
};

/**
 * Get medical protocol for a specific condition or symptom
 * @param {string} condition - Medical condition or symptom
 * @returns {Promise} - Promise with medical protocol
 */
export const getMedicalProtocol = async (condition) => {
  try {
    return await api.get(`knowledge/protocols/${encodeURIComponent(condition)}`);
  } catch (error) {
    console.error('Failed to retrieve medical protocol:', error);
    // Fallback to local protocol if available
    return getLocalMedicalProtocol(condition);
  }
};

/**
 * Get red flags for a specific condition or symptom
 * @param {string} condition - Medical condition or symptom
 * @returns {Promise} - Promise with red flags
 */
export const getRedFlags = async (condition) => {
  try {
    return await api.get(`knowledge/red-flags/${encodeURIComponent(condition)}`);
  } catch (error) {
    console.error('Failed to retrieve red flags:', error);
    // Fallback to local red flags if available
    return getLocalRedFlags(condition);
  }
};

/**
 * Get recommended follow-up questions for a specific condition
 * @param {string} condition - Medical condition or symptom
 * @param {Array} askedQuestions - Questions already asked
 * @returns {Promise} - Promise with follow-up questions
 */
export const getFollowUpQuestions = async (condition, askedQuestions = []) => {
  try {
    return await api.post('knowledge/follow-up-questions', {
      condition,
      askedQuestions
    });
  } catch (error) {
    console.error('Failed to retrieve follow-up questions:', error);
    // Fallback to local follow-up questions if available
    return getLocalFollowUpQuestions(condition, askedQuestions);
  }
};

// -------------------------
// Mock implementations for offline development and testing
// -------------------------

/**
 * Local implementation of medical information retrieval
 * @param {string} query - The medical query
 * @param {Object} context - Additional context
 * @returns {Object} - Medical information
 */
const getLocalMedicalInformation = (query, context = {}) => {
  const queryLower = query.toLowerCase();
  
  // Simple mock knowledge base
  if (queryLower.includes('chest pain')) {
    return Promise.resolve({
      information: `Chest pain can be caused by various conditions ranging from non-serious to life-threatening. Common causes include heart conditions (heart attack, angina), lung conditions (pneumonia, pulmonary embolism), gastrointestinal issues (acid reflux), musculoskeletal problems, or anxiety. Any chest pain, particularly if sudden, severe, or accompanied by shortness of breath, sweating, or nausea should be evaluated urgently.`,
      sources: ['American Heart Association', 'Mayo Clinic'],
      urgencyIndicator: 'high'
    });
  } 
  else if (queryLower.includes('headache')) {
    return Promise.resolve({
      information: `Headaches can be primary (not caused by another condition) like tension headaches, migraines, or cluster headaches, or secondary (caused by another condition) like sinus infections, medication overuse, or more serious conditions. Most headaches are not serious, but sudden severe headaches, headaches with fever, confusion, or neurological symptoms require immediate evaluation.`,
      sources: ['American Migraine Foundation', 'National Institute of Neurological Disorders and Stroke'],
      urgencyIndicator: 'medium'
    });
  }
  else if (queryLower.includes('fever')) {
    return Promise.resolve({
      information: `Fever is typically defined as a body temperature above 100.4°F (38°C). It's usually a sign that your body is fighting an infection. Common causes include viral infections, bacterial infections, and inflammatory conditions. In adults, a fever isn't usually concerning unless it reaches 103°F (39.4°C) or higher, lasts more than 3 days, or is accompanied by severe symptoms like difficulty breathing, confusion, or severe pain.`,
      sources: ['CDC', 'Mayo Clinic'],
      urgencyIndicator: 'medium'
    });
  }
  else {
    return Promise.resolve({
      information: `Limited information is available for this specific query. It's recommended to consult with a healthcare provider for personalized medical advice.`,
      sources: [],
      urgencyIndicator: 'unknown'
    });
  }
};

/**
 * Local implementation of medical protocol retrieval
 * @param {string} condition - Medical condition or symptom
 * @returns {Object} - Medical protocol
 */
const getLocalMedicalProtocol = (condition) => {
  const conditionLower = condition.toLowerCase();
  
  // Simple mock protocols
  if (conditionLower.includes('chest pain')) {
    return Promise.resolve({
      protocol: [
        'Assess for signs of cardiac arrest or shock',
        'Check vital signs including blood pressure and pulse',
        'Evaluate pain characteristics (location, radiation, quality, intensity)',
        'Check for shortness of breath, sweating, nausea, or vomiting',
        'Assess risk factors for heart disease',
        'Consider ECG if available',
        'Determine urgency based on symptoms and risk factors'
      ],
      recommendedAction: 'emergency evaluation'
    });
  }
  else if (conditionLower.includes('headache')) {
    return Promise.resolve({
      protocol: [
        'Assess pain characteristics (location, intensity, pattern)',
        'Check for associated symptoms (nausea, visual changes, fever)',
        'Evaluate for red flags (sudden onset, worst headache of life, neurological deficits)',
        'Check recent medication use or changes',
        'Assess impact on daily activities',
        'Determine urgency based on symptoms and red flags'
      ],
      recommendedAction: 'varies by symptoms'
    });
  }
  else {
    return Promise.resolve({
      protocol: [
        'Assess symptom severity and duration',
        'Check for associated symptoms',
        'Evaluate impact on daily activities',
        'Consider relevant medical history',
        'Determine appropriate level of care based on findings'
      ],
      recommendedAction: 'consult healthcare provider'
    });
  }
};

/**
 * Local implementation of red flags retrieval
 * @param {string} condition - Medical condition or symptom
 * @returns {Object} - Red flags
 */
const getLocalRedFlags = (condition) => {
  const conditionLower = condition.toLowerCase();
  
  // Simple mock red flags
  if (conditionLower.includes('chest pain')) {
    return Promise.resolve({
      redFlags: [
        'Pain radiating to arm, jaw, or back',
        'Shortness of breath',
        'Nausea or vomiting',
        'Sweating (diaphoresis)',
        'Lightheadedness or dizziness',
        'Irregular heartbeat',
        'Sudden, severe pain described as "tearing"'
      ],
      urgencyLevel: 'emergency'
    });
  }
  else if (conditionLower.includes('headache')) {
    return Promise.resolve({
      redFlags: [
        'Sudden onset ("thunderclap headache")',
        'Described as "worst headache of life"',
        'Neurological symptoms (weakness, numbness, speech changes)',
        'Fever with stiff neck',
        'Vision changes',
        'Headache worsening with position changes',
        'Headache after head injury'
      ],
      urgencyLevel: 'urgent'
    });
  }
  else if (conditionLower.includes('fever')) {
    return Promise.resolve({
      redFlags: [
        'Temperature above 103°F (39.4°C) in adults',
        'Fever lasting more than 3 days',
        'Difficult breathing',
        'Chest pain',
        'Severe headache',
        'Stiff neck',
        'Confusion or extreme lethargy',
        'Rash (especially one that doesn\'t fade when pressed)'
      ],
      urgencyLevel: 'varies by symptoms'
    });
  }
  else {
    return Promise.resolve({
      redFlags: [
        'Severe, sudden-onset symptoms',
        'Changes in consciousness or alertness',
        'Breathing difficulties',
        'Severe pain',
        'Symptoms that interfere with daily activities'
      ],
      urgencyLevel: 'varies by symptoms'
    });
  }
};

/**
 * Local implementation of follow-up questions retrieval
 * @param {string} condition - Medical condition or symptom
 * @param {Array} askedQuestions - Questions already asked
 * @returns {Object} - Follow-up questions and additional information
 */