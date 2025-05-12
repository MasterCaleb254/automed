// api/controllers/triageController.js
const triageService = require('../../services/triageService');
const { validateTriageRequest } = require('../../utils/validation');

// Start a new triage session
exports.startTriageSession = async (req, res, next) => {
  try {
    const { patientInfo } = req.body;
    
    // Validate request data
    const validationError = validateTriageRequest(patientInfo);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }
    
    // Create new triage session
    const session = await triageService.createSession(patientInfo, req.user.id);
    
    res.status(201).json({
      success: true,
      sessionId: session.id,
      greeting: session.initialMessage
    });
  } catch (error) {
    next(error);
  }
};

// Process a message in an ongoing triage
exports.processMessage = async (req, res, next) => {
  try {
    const { sessionId, message } = req.body;
    
    if (!sessionId || !message) {
      return res.status(400).json({ error: 'Session ID and message are required' });
    }
    
    const response = await triageService.processUserMessage(sessionId, message);
    
    res.json({
      success: true,
      response: response.message,
      complete: response.triageComplete,
      urgencyLevel: response.urgencyLevel || null,
      recommendedAction: response.recommendedAction || null
    });
  } catch (error) {
    next(error);
  }
};

// Get the final triage result
exports.getTriageResult = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    
    const result = await triageService.getTriageResult(sessionId);
    
    if (!result) {
      return res.status(404).json({ error: 'Triage session not found' });
    }
    
    res.json({
      success: true,
      result
    });
  } catch (error) {
    next(error);
  }
};

// Get patient triage history
exports.getPatientHistory = async (req, res, next) => {
  try {
    const patientId = req.user.id;
    
    const history = await triageService.getPatientTriageHistory(patientId);
    
    res.json({
      success: true,
      history
    });
  } catch (error) {
    next(error);
  }
};