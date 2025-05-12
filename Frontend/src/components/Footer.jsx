// src/components/Footer.jsx
import React from 'react';

function Footer() {
  return (
    <footer className="app-footer">
      <div className="footer-content">
        <div className="footer-section">
          <h3>AutoMed Triage</h3>
          <p>An AI-powered medical triage system</p>
        </div>
        <div className="footer-section">
          <h3>Important Notice</h3>
          <p>This system is for informational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment.</p>
        </div>
        <div className="footer-section">
          <h3>Emergency</h3>
          <p>In case of emergency, please call emergency services immediately.</p>
        </div>
      </div>
      <div className="footer-bottom">
        <p>&copy; {new Date().getFullYear()} AutoMed. All rights reserved.</p>
        <div className="footer-links">
          <a href="#terms">Terms of Service</a>
          <a href="#privacy">Privacy Policy</a>
          <a href="#contact">Contact Us</a>
        </div>
      </div>
    </footer>
  );
}

export default Footer;