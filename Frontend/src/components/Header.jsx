// src/components/Header.jsx
import React from "react";
import { FaRobot, FaStethoscope, FaHeartbeat } from "react-icons/fa";
import './Header.css'; // Optional: link to a separate stylesheet for styling

const Header = () => {
  return (
    <header className="header-container">
      <div className="logo-section">
        <h1 className="logo">
          <FaRobot className="logo-icon" /> AutoMed
        </h1>
        <p className="tagline">Revolutionizing Medical Triage with AI</p>
      </div>
      
      <nav className="navigation">
        <ul className="nav-links">
          <li><a href="#home" className="nav-item">Home</a></li>
          <li><a href="#about" className="nav-item">About</a></li>
          <li><a href="#features" className="nav-item">Features</a></li>
          <li><a href="#contact" className="nav-item">Contact</a></li>
        </ul>
      </nav>

      <div className="cta-section">
        <button className="cta-button">Get Started</button>
        <div className="cta-icons">
          <FaStethoscope className="cta-icon" />
          <FaHeartbeat className="cta-icon" />
        </div>
      </div>
    </header>
  );
};

export default Header;
