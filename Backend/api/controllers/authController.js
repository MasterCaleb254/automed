// api/controllers/authController.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const PatientModel = require('../../models/patient');
const config = require('../../config/database');

// Register a new patient
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, dateOfBirth, gender } = req.body;
    
    // Check if user already exists
    const existingUser = await PatientModel.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create new patient
    const newPatient = await PatientModel.create({
      name,
      email,
      password: hashedPassword,
      dateOfBirth,
      gender,
      registeredAt: new Date()
    });
    
    // Generate JWT token
    const token = jwt.sign(
      { id: newPatient.id, email: newPatient.email },
      config.jwtSecret,
      { expiresIn: '7d' }
    );
    
    res.status(201).json({
      success: true,
      token,
      user: {
        id: newPatient.id,
        name: newPatient.name,
        email: newPatient.email
      }
    });
  } catch (error) {
    next(error);
  }
};

// Login existing patient
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    // Find user by email
    const patient = await PatientModel.findByEmail(email);
    if (!patient) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Verify password
    const passwordMatch = await bcrypt.compare(password, patient.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { id: patient.id, email: patient.email },
      config.jwtSecret,
      { expiresIn: '7d' }
    );
    
    res.json({
      success: true,
      token,
      user: {
        id: patient.id,
        name: patient.name,
        email: patient.email
      }
    });
  } catch (error) {
    next(error);
  }
};