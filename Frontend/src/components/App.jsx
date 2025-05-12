// src/App.jsx
import React from 'react';
import Header from './Header';
import Footer from "./Footer";
import ChatInterface from './ChatInterface';
import TriageForm from './TriageForm';
import TriageResult from './TriageResult';
import LoadingIndicator from './LoadingIndicator';
import "/src/styles/global.css";



function App() {
  const [step, setStep] = useState('initial'); // initial, form, chat, result
  const [loading, setLoading] = useState(false);
  const [patientData, setPatientData] = useState({});
  const [triageResult, setTriageResult] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);

  const startTriage = () => {
    setStep('form');
  };

  const handleFormSubmit = (formData) => {
    setPatientData(formData);
    setLoading(true);
    // Simulate API call to initialize triage session
    setTimeout(() => {
      setLoading(false);
      setStep('chat');
      setChatHistory([
        {
          role: 'system',
          content: `Hello ${formData.firstName}, I'm AutoMed, your virtual medical assistant. I'll be asking you some questions to understand your symptoms and help determine the appropriate level of care. This is not a replacement for emergency services - if you're experiencing severe or life-threatening symptoms, please call emergency services immediately.`,
        },
      ]);
    }, 1500);
  };

  const handleChatComplete = (result) => {
    setTriageResult(result);
    setStep('result');
  };

  return (
    <div className="app-container">
      <Header />
      <main className="main-content">
        {loading && <LoadingIndicator />}
        
        {step === 'initial' && (
          <div className="welcome-screen">
            <h1>Welcome to AutoMed Triage</h1>
            <p>
              AutoMed helps you assess your symptoms and determine what level of medical care you might need.
            </p>
            <p className="warning">
              <strong>Important:</strong> This is not a replacement for emergency services. 
              If you're experiencing severe or life-threatening symptoms, please call emergency services immediately.
            </p>
            <button className="primary-button" onClick={startTriage}>
              Start Triage Assessment
            </button>
          </div>
        )}

        {step === 'form' && <TriageForm onSubmit={handleFormSubmit} />}
        
        {step === 'chat' && (
          <ChatInterface 
            chatHistory={chatHistory} 
            setChatHistory={setChatHistory}
            patientData={patientData}
            onComplete={handleChatComplete}
          />
        )}
        
        {step === 'result' && (
          <TriageResult 
            result={triageResult} 
            patientData={patientData}
            onRestart={() => setStep('initial')}
          />
        )}
      </main>
      <Footer />
    </div>
  );
}

export default App;
