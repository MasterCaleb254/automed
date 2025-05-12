// middleware/errorHandler.js
const logger = require('../utils/logging');

exports.errorHandler = (err, req, res, next) => {
  // Log the error
  logger.error(`${err.name}: ${err.message}`, { 
    stack: err.stack,
    path: req.path,
    method: req.method
  });
  
  // Determine status code
  const statusCode = err.statusCode || 500;
  
  // Send response
  res.status(statusCode).json({
    error: statusCode === 500 ? 'Internal server error' : err.message,
    success: false
  });
};