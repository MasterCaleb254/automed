// api/routes.js
const express = require('express');
const triageController = require('./controllers/triageController');
const authController = require('./controllers/authController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Auth routes
router.post('/register', authController.register);
router.post('/login', authController.login);

// Triage routes
router.post('/triage/start', authenticate, triageController.startTriageSession);
router.post('/triage/message', authenticate, triageController.processMessage);
router.get('/triage/result/:sessionId', authenticate, triageController.getTriageResult);
router.get('/triage/history', authenticate, triageController.getPatientHistory);

module.exports = router;