// server.js
const express = require('express');
const cors = require('cors');
const routes = require('./api/routes');
const { errorHandler } = require('./middleware/errorHandler');
const { connectToDatabase } = require('./database');
const config = require('./config/database');

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api', routes);

// Error handling middleware
app.use(errorHandler);

// Start server
async function startServer() {
  try {
    // Connect to database if needed
    if (config.useDatabase) {
      await connectToDatabase();
      console.log('Connected to database');
    }
    
    app.listen(PORT, () => {
      console.log(`AutoMed backend server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app; // For testing purposes