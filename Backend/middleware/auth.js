// middleware/auth.js
const jwt = require('jsonwebtoken');
const config = require('../config/database');
const PatientModel = require('../models/patient');

// Authenticate JWT token
exports.authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify token
    jwt.verify(token, config.jwtSecret, async (err, decoded) => {
      if (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
      
      // Get user from database
      const user = await PatientModel.findById(decoded.id);
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }
      
      // Attach user to request
      req.user = {
        id: user.id,
        email: user.email,
        name: user.name
      };
      
      next();
    });
  } catch (error) {
    return res.status(500).json({ error: 'Authentication error' });
  }
};