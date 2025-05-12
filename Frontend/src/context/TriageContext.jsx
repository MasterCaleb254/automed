// src/components/TriageForm.jsx
import React, { useState } from 'react';

function TriageForm({ onSubmit }) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    age: '',
    gender: '',
    medicalHistory: '',
    currentMedications: '',
    allergies: '',
    chiefComplaint: '',
  });

  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!formData.age) newErrors.age = 'Age is required';
    if (formData.age < 0 || formData.age > 120) newErrors.age = 'Please enter a valid age';
    if (!formData.gender) newErrors.gender = 'Gender is required';
    if (!formData.chiefComplaint.trim()) newErrors.chiefComplaint = 'Chief complaint is required';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  return (
    <div className="triage-form-container">
      <h2>Patient Information</h2>
      <p>Please provide your information to begin the triage process.</p>
      
      <form className="triage-form" onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="firstName">First Name*</label>
            <input
              type="text"
              id="firstName"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              className={errors.firstName ? 'error' : ''}
            />
            {errors.firstName && <span className="error-message">{errors.firstName}</span>}
          </div>
          
          <div className="form-group">
            <label htmlFor="lastName">Last Name*</label>
            <input
              type="text"
              id="lastName"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              className={errors.lastName ? 'error' : ''}
            />
            {errors.lastName && <span className="error-message">{errors.lastName}</span>}
          </div>
        </div>
        
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="age">Age*</label>
            <input
              type="number"
              id="age"
              name="age"
              value={formData.age}
              onChange={handleChange}
              min="0"
              max="120"
              className={errors.age ? 'error' : ''}
            />
            {errors.age && <span className="error-message">{errors.age}</span>}
          </div>
          
          <div className="form-group">
            <label htmlFor="gender">Gender*</label>
            <select
              id="gender"
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              className={errors.gender ? 'error' : ''}
            >
              <option value="">Select</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="nonbinary">Non-binary</option>
              <option value="other">Other</option>
              <option value="prefer-not-to-say">Prefer not to say</option>
            </select>
            {errors.gender && <span className="error-message">{errors.gender}</span>}
          </div>
        </div>
        
        <div className="form-group">
          <label htmlFor="medicalHistory">Medical History (Optional)</label>
          <textarea
            id="medicalHistory"
            name="medicalHistory"
            value={formData.medicalHistory}
            onChange={handleChange}
            placeholder="List any significant medical conditions (e.g., diabetes, heart disease, asthma)"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="currentMedications">Current Medications (Optional)</label>
          <textarea
            id="currentMedications"
            name="currentMedications"
            value={formData.currentMedications}
            onChange={handleChange}
            placeholder="List medications you're currently taking"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="allergies">Allergies (Optional)</label>
          <textarea
            id="allergies"
            name="allergies"
            value={formData.allergies}
            onChange={handleChange}
            placeholder="List any medication allergies or other significant allergies"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="chiefComplaint">What brings you in today?*</label>
          <textarea
            id="chiefComplaint"
            name="chiefComplaint"
            value={formData.chiefComplaint}
            onChange={handleChange}
            placeholder="Describe your main symptoms or concerns"
            className={errors.chiefComplaint ? 'error' : ''}
          />
          {errors.chiefComplaint && <span className="error-message">{errors.chiefComplaint}</span>}
        </div>
        
        <div className="form-actions">
          <p className="required-fields">* Required fields</p>
          <button type="submit" className="primary-button">
            Continue to Assessment
          </button>
        </div>
      </form>
    </div>
  );
}

export default TriageForm;