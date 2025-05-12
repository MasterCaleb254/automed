import { useTranslation } from 'react-i18next';  // Import the hook

const VoiceInput = ({ onResult }) => {
  const { t } = useTranslation();  // Initialize the translation function
  const [listening, setListening] = useState(false);
  let recognition = null;

  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
      setListening(false);
    };

    recognition.onerror = () => {
      setListening(false);
    };
  }

  const handleClick = () => {
    if (recognition) {
      if (!listening) {
        recognition.start();
        setListening(true);
      } else {
        recognition.stop();
        setListening(false);
      }
    } else {
      alert('Sorry, your browser does not support Speech Recognition.');
    }
  };

  return (
    <button onClick={handleClick} className="voice-button">
      {listening ? t('listening') : t('start_voice_input')} {/* Use translation */}
    </button>
  );
};
recognition.onerror = (event) => {
  setListening(false);
  if (event.error === 'not-allowed') {
    alert('Microphone access was denied. Please enable mic permissions to use voice input.');
  } else {
    alert('An error occurred with voice recognition.');
  }
};
