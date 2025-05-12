# Medical Triage Decision Engine
# Core decision-making component for AI Medical Triage Agent

from langchain.prompts import ChatPromptTemplate
from langchain.output_parsers import PydanticOutputParser
from langchain.chains import LLMChain, SequentialChain
from langchain.chat_models import ChatOpenAI
from langchain.vectorstores import Chroma
from langchain.embeddings import OpenAIEmbeddings
from langchain.callbacks import get_openai_callback
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import os
from enum import Enum

# Define the Triage Levels with clear medical significance
class TriageLevel(str, Enum):
    EMERGENCY = "EMERGENCY"  # Immediate medical attention required (minutes)
    URGENT = "URGENT"        # Prompt medical attention required (hours)
    SEMI_URGENT = "SEMI_URGENT"  # Medical attention required soon (same day)
    NON_URGENT = "NON_URGENT"    # Routine care (days)
    SELF_CARE = "SELF_CARE"      # Home care with monitoring

# Output schemas for different stages of the decision engine
class ExtractedSymptoms(BaseModel):
    symptoms: List[str] = Field(description="List of symptoms extracted from user description")
    duration: Optional[str] = Field(description="Duration of symptoms if mentioned")
    severity: Optional[str] = Field(description="Perceived severity if mentioned")
    relevant_history: Optional[str] = Field(description="Relevant medical history if mentioned")
    age: Optional[int] = Field(description="Patient age if mentioned")

class RiskAssessment(BaseModel):
    triage_level: TriageLevel = Field(description="Assessed triage level based on symptoms")
    reasoning: str = Field(description="Clinical reasoning for the triage level")
    confidence: float = Field(description="Confidence score between 0 and 1")
    red_flags: List[str] = Field(description="Critical symptoms requiring immediate attention")
    
class TriageRecommendation(BaseModel):
    triage_level: TriageLevel = Field(description="Final triage recommendation")
    recommended_action: str = Field(description="Specific action the patient should take")
    timeframe: str = Field(description="Timeframe for seeking care")
    reasoning: str = Field(description="Explanation for recommendation")
    warning_signs: Optional[List[str]] = Field(description="Symptoms that would warrant upgrading urgency")
    follow_up: Optional[str] = Field(description="Follow-up recommendations")
    disclaimer: str = Field(description="Medical disclaimer about limitations of AI triage")

class DecisionEngine:
    def __init__(self, model_name="gpt-4", temperature=0.0, verbose=True):
        self.llm = ChatOpenAI(model_name=model_name, temperature=temperature)
        self.verbose = verbose
        
        # Initialize RAG components
        self.setup_rag_system()
        
        # Initialize the chain components
        self._create_chains()
    
    def setup_rag_system(self):
        """Initialize the RAG components for medical knowledge retrieval"""
        # For production, replace with actual medical corpus
        # This is a placeholder - in a real system you'd load your medical knowledge base
        try:
            self.embeddings = OpenAIEmbeddings()
            # In production: Load actual medical data
            # self.vectorstore = Chroma(embedding_function=self.embeddings, persist_directory="./medical_data")
            self.vectorstore = None  # Placeholder
        except Exception as e:
            print(f"RAG system initialization error: {e}")
            # Fallback to functioning without RAG if necessary
            self.vectorstore = None
    
    def _create_chains(self):
        """Create the LangChain components for the decision engine"""
        # 1. Symptom Extraction Chain
        symptom_template = """
        You are a medical professional extracting symptoms from patient descriptions.
        Extract all relevant medical information from the following patient description:
        
        Patient description: {user_input}
        
        Extract only factual information. Do not infer additional symptoms beyond what's stated.
        """
        symptom_prompt = ChatPromptTemplate.from_template(symptom_template)
        symptom_parser = PydanticOutputParser(pydantic_object=ExtractedSymptoms)
        self.symptom_chain = LLMChain(
            llm=self.llm,
            prompt=symptom_prompt,
            output_parser=symptom_parser,
            output_key="extracted_symptoms",
            verbose=self.verbose
        )
        
        # 2. Risk Assessment Chain
        risk_template = """
        You are an experienced emergency medicine physician conducting triage.
        Based on the following extracted symptoms, assess the appropriate triage level:
        
        Extracted symptoms: {extracted_symptoms}
        
        Consider:
        1. Life-threatening conditions require EMERGENCY triage
        2. Severe pain or potential for serious complications require URGENT triage
        3. Conditions needing same-day care require SEMI_URGENT triage
        4. Routine medical issues require NON_URGENT triage
        5. Minor issues manageable at home require SELF_CARE triage
        
        Always prioritize patient safety. When in doubt, assign a higher urgency level.
        
        {rag_context}
        """
        risk_prompt = ChatPromptTemplate.from_template(risk_template)
        risk_parser = PydanticOutputParser(pydantic_object=RiskAssessment)
        self.risk_chain = LLMChain(
            llm=self.llm,
            prompt=risk_prompt,
            output_parser=risk_parser,
            output_key="risk_assessment",
            verbose=self.verbose
        )
        
        # 3. Final Recommendation Chain
        recommendation_template = """
        You are an AI medical triage system providing recommendations based on a risk assessment.
        
        Risk Assessment: {risk_assessment}
        
        Create a clear, compassionate recommendation for the patient that includes:
        1. The appropriate action to take (e.g., "Call emergency services", "Visit urgent care")
        2. A timeframe for seeking care
        3. Warning signs that would require escalation
        4. A medical disclaimer about the limitations of AI triage
        
        Be direct and clear while showing appropriate concern. Always err on the side of caution.
        """
        recommendation_prompt = ChatPromptTemplate.from_template(recommendation_template)
        recommendation_parser = PydanticOutputParser(pydantic_object=TriageRecommendation)
        self.recommendation_chain = LLMChain(
            llm=self.llm,
            prompt=recommendation_prompt,
            output_parser=recommendation_parser,
            output_key="triage_recommendation",
            verbose=self.verbose
        )
    
    def retrieve_medical_knowledge(self, symptoms):
        """Retrieve relevant medical knowledge from the RAG system"""
        if not self.vectorstore:
            return "No additional medical context available."
            
        # Query the vector store for relevant medical information
        query = " ".join(symptoms)
        docs = self.vectorstore.similarity_search(query, k=3)
        
        # Format the retrieved knowledge
        if docs:
            context = "Medical Context:\n"
            for i, doc in enumerate(docs):
                context += f"{i+1}. {doc.page_content}\n"
            return context
        else:
            return "No specific medical guidelines found for these symptoms."
    
    def triage(self, user_input):
        """Main triage function that processes user input and returns a recommendation"""
        with get_openai_callback() as cb:
            try:
                # Step 1: Extract symptoms
                extraction_result = self.symptom_chain.invoke({"user_input": user_input})
                extracted_symptoms = extraction_result["extracted_symptoms"]
                
                # Step 2: Retrieve relevant medical knowledge (RAG)
                rag_context = self.retrieve_medical_knowledge(extracted_symptoms.symptoms)
                
                # Step 3: Perform risk assessment
                risk_result = self.risk_chain.invoke({
                    "extracted_symptoms": extracted_symptoms.dict(),
                    "rag_context": rag_context
                })
                risk_assessment = risk_result["risk_assessment"]
                
                # Step 4: Generate recommendation
                recommendation_result = self.recommendation_chain.invoke({
                    "risk_assessment": risk_assessment.dict()
                })
                recommendation = recommendation_result["triage_recommendation"]
                
                # Compile and return results
                response = {
                    "extracted_symptoms": extracted_symptoms.dict(),
                    "risk_assessment": risk_assessment.dict(),
                    "recommendation": recommendation.dict(),
                    "tokens_used": cb.total_tokens
                }
                
                return response
                
            except Exception as e:
                # Safety fallback
                error_response = {
                    "error": str(e),
                    "recommendation": {
                        "triage_level": TriageLevel.URGENT,
                        "recommended_action": "Due to a system error in processing your symptoms, we recommend consulting with a healthcare provider to be safe.",
                        "timeframe": "As soon as possible",
                        "reasoning": "The system encountered an error while analyzing your symptoms.",
                        "disclaimer": "This is an automated recommendation. Always seek professional medical advice for health concerns."
                    }
                }
                return error_response

# Example decision rules for specific conditions (expand for production)
class MedicalRules:
    @staticmethod
    def chest_pain_protocol(symptoms, patient_data):
        """Protocol for handling chest pain"""
        red_flags = [
            "chest pressure", "chest tightness", "radiating pain", 
            "shortness of breath", "nausea", "sweating"
        ]
        
        # Check for heart attack warning signs
        for flag in red_flags:
            if any(flag in symptom.lower() for symptom in symptoms):
                return TriageLevel.EMERGENCY
        
        # Age is a risk factor for cardiac events
        if patient_data.get("age", 0) > 40:
            return TriageLevel.URGENT
            
        return TriageLevel.SEMI_URGENT

    @staticmethod
    def head_injury_protocol(symptoms, patient_data):
        """Protocol for handling head injuries"""
        red_flags = [
            "loss of consciousness", "confusion", "severe headache",
            "vomiting", "seizure", "unequal pupils"
        ]
        
        # Check for serious head injury signs
        for flag in red_flags:
            if any(flag in symptom.lower() for symptom in symptoms):
                return TriageLevel.EMERGENCY
                
        return TriageLevel.URGENT

# Usage example:
if __name__ == "__main__":
    # Initialize the decision engine
    engine = DecisionEngine()
    
    # Example patient input
    patient_description = "I've had a headache for the past 3 days. Over-the-counter pain medicine isn't helping much. No fever or other symptoms."
    
    # Run the triage
    result = engine.triage(patient_description)
    
    # Display the results
    print("MEDICAL TRIAGE RESULT")
    print("=====================")
    print(f"Triage Level: {result['recommendation']['triage_level']}")
    print(f"Recommendation: {result['recommendation']['recommended_action']}")
    print(f"Timeframe: {result['recommendation']['timeframe']}")
    print(f"Reasoning: {result['recommendation']['reasoning']}")
    if result['recommendation'].get('warning_signs'):
        print("Warning Signs:")
        for sign in result['recommendation']['warning_signs']:
            print(f"- {sign}")
    print(f"\nDisclaimer: {result['recommendation']['disclaimer']}")
    print(f"\nTokens used: {result['tokens_used']}")

    # Define symptom severity
symptom_severity = {
    "chest pain": 10,
    "shortness of breath": 9,
    "headache": 3,
    "sore throat": 2,
    # Add other symptoms with severity scores as needed
}

# Function to calculate triage priority based on symptoms
def triage_symptoms(symptoms):
    severity_score = 0
    
    # Loop through the symptoms and calculate the total severity score
    for symptom in symptoms:
        symptom = symptom.lower()  # Convert to lowercase to handle case insensitivity
        if symptom in symptom_severity:
            severity_score += symptom_severity[symptom]
    
    # Determine triage priority based on the severity score
    if severity_score >= 15:
        return "High Priority"
    elif severity_score >= 5:
        return "Medium Priority"
    else:
        return "Low Priority"

# Example usage
symptoms = ["chest pain", "headache", "sore throat"]
priority = triage_symptoms(symptoms)
print(f"Triage Priority: {priority}")

