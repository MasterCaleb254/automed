// src/services/triageService.js
// This is a mock service to simulate backend functionality
// In a real application, this would connect to your Node.js/Python backend

// Simulated triage flow stages
const TRIAGE_STAGES = {
    INITIAL: 'initial',
    SYMPTOM_DETAILS: 'symptom_details',
    MEDICAL_HISTORY_RELEVANCE: 'medical_history_relevance',
    RED_FLAGS: 'red_flags',
    CLARIFICATION: 'clarification',
    FINAL: 'final'
  };
  
  // Mock conversation state
  let currentStage = TRIAGE_STAGES.INITIAL;
  let collectedInfo = {};
  let questionCount = 0;
  
  // Function to analyze the chief complaint and generate appropriate questions
  const analyzeChiefComplaint = (complaint) => {
    // This would be handled by the LLM in a real implementation
    // Here we just return some generic questions based on the complaint text
    
    if (complaint.toLowerCase().includes('chest pain')) {
      return {
        nextQuestions: [
          "Is the pain sharp, dull, crushing, or burning?",
          "Does the pain radiate to your arm, jaw, or back?",
          "On a scale of 1-10, how severe is the pain?",
          "Are you experiencing any shortness of breath, nausea, or sweating?"
        ],
        potentialUrgency: 'emergency',
        redFlags: ['chest pain radiating to arm or jaw', 'shortness of breath', 'nausea with chest pain']
      };
    } else if (complaint.toLowerCase().includes('headache')) {
      return {
        nextQuestions: [
          "How long have you had this headache?",
          "On a scale of 1-10, how severe is the pain?",
          "Have you had any nausea, vomiting, or sensitivity to light?",
          "Have you experienced any unusual symptoms like confusion or weakness on one side?"
        ],
        potentialUrgency: 'semi-urgent',
        redFlags: ['worst headache of life', 'sudden onset', 'neurological symptoms']
      };
    } else {
      // Generic questions for any complaint
      return {
        nextQuestions: [
          "How long have you been experiencing these symptoms?",
          "On a scale of 1-10, how severe would you rate your discomfort?",
          "Have you experienced these symptoms before?",
          "Does anything make the symptoms better or worse?"
        ],
        potentialUrgency: 'non-urgent',
        redFlags: []
      };
    }
  };
  
  // Reset the triage session
  export const resetTriageSession = () => {
    currentStage = TRIAGE_STAGES.INITIAL;
    collectedInfo = {};
    questionCount = 0;
  };
  
  // Process a triage message
  export const processTriageMessage = async (chatHistory, patientData) => {
    // In a real implementation, this would call your backend API
    // which would interact with the LLM and RAG system
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const userMessage = chatHistory[chatHistory.length - 1].content;
    
    // Update collected info
    collectedInfo = { 
      ...collectedInfo,
      lastResponse: userMessage 
    };
    
    // Get the chief complaint from patient data
    const chiefComplaint = patientData.chiefComplaint;
    
    // Increment question counter
    questionCount++;
    
    // Based on the current stage, determine the next question or complete the triage
    switch (currentStage) {
      case TRIAGE_STAGES.INITIAL:
        currentStage = TRIAGE_STAGES.SYMPTOM_DETAILS;
        const analysis = analyzeChiefComplaint(chiefComplaint);
        collectedInfo.analysis = analysis;
        
        // Return the first detailed question
        return {
          message: analysis.nextQuestions[0],
          complete: false
        };
        
      case TRIAGE_STAGES.SYMPTOM_DETAILS:
        if (questionCount < 3) {
          // Ask another symptom detail question
          return {
            message: collectedInfo.analysis.nextQuestions[questionCount],
            complete: false
          };
        } else {
          // Move to red flags assessment
          currentStage = TRIAGE_STAGES.RED_FLAGS;
          return {
            message: "Thank you for those details. Have you experienced any of the following: " + 
                     collectedInfo.analysis.redFlags.join(", ") + "?",
            complete: false
          };
        }
        
      case TRIAGE_STAGES.RED_FLAGS:
        // Check for urgent red flags in the response
        const hasRedFlags = collectedInfo.analysis.redFlags.some(flag => 
          userMessage.toLowerCase().includes("yes") || userMessage.toLowerCase().includes(flag.toLowerCase())
        );
        
        if (hasRedFlags) {
          collectedInfo.urgencyLevel = "urgent";
        }
        
        currentStage = TRIAGE_STAGES.MEDICAL_HISTORY_RELEVANCE;
        return {
          message: "Do you have any relevant medical history that might be related to your current symptoms?",
          complete: false
        };
        
      case TRIAGE_STAGES.MEDICAL_HISTORY_RELEVANCE:
        // Store the medical history information
        collectedInfo.relevantMedicalHistory = userMessage;
        
        currentStage = TRIAGE_STAGES.CLARIFICATION;
        return {
          message: "Is there anything else important about your condition that we should know?",
          complete: false
        };
        
      case TRIAGE_STAGES.CLARIFICATION:
        // Store the additional information
        collectedInfo.additionalInfo = userMessage;
        
        // Move to final stage
        currentStage = TRIAGE_STAGES.FINAL;
        
        // Determine final urgency level
        let urgencyLevel = collectedInfo.urgencyLevel || collectedInfo.analysis.potentialUrgency;
        
        // Prepare triage result
            return {
              urgencyLevel,
              recommendation: getRecommendationByUrgency(urgencyLevel),
              warnings: getWarningsByUrgency(urgencyLevel),
              nextSteps: getNextStepsByUrgency(urgencyLevel)
            };
          }
        }
        


import React, { useState, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { TriageContext } from '../context/TriageContext';
import VoiceInput from './VoiceInput';

const TriageForm = () => {
  const { t } = useTranslation(); // Initialize the translation function
  const { submitSymptoms } = useContext(TriageContext);
  const [symptoms, setSymptoms] = useState('');

// Removed duplicate handleSubmit and handleVoiceResult declarations and unreachable code

  const handleSubmit = (e) => {
    e.preventDefault();
    if (symptoms.trim() !== '') {
      submitSymptoms(symptoms);
      setSymptoms('');
    }
  };

  const handleVoiceResult = (voiceText) => {
    setSymptoms(voiceText);
  };

  return (
    <form onSubmit={handleSubmit}>
      <textarea
        value={symptoms}
        onChange={(e) => setSymptoms(e.target.value)}
        placeholder={t('symptoms_placeholder')} // Use translation for placeholder
        rows={4}
      />
      <button type="submit">{t('submit')}</button> {/* Use translation for button text */}

      {/* Voice Input Button */}
      <VoiceInput onResult={handleVoiceResult} />
    </form>
  );
};

// Ensure only one default export per file
export default TriageForm;
