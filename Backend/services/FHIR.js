class FHIRClient {
  constructor(baseUrl, authToken) {
    this.baseUrl = baseUrl;
    this.authToken = authToken;
    this.resourceTypes = [
      'Patient', 'Observation', 'Condition', 
      'MedicationStatement', 'AllergyIntolerance',
      'Procedure', 'Encounter'
    ];
  }
  
  async initialize() {
    try {
      // Verify connection and capabilities
      const metadata = await this.fetchMetadata();
      console.log('FHIR server capabilities:', metadata);
      return true;
    } catch (error) {
      console.error('Failed to initialize FHIR client:', error);
      return false;
    }
  }
  
  async fetchMetadata() {
    return this.request('GET', '/metadata');
  }
  
  async request(method, path, data = null) {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      'Content-Type': 'application/fhir+json',
      'Accept': 'application/fhir+json'
    };
    
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    
    const options = {
      method,
      headers
    };
    
    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }
    
    const response = await fetch(url, options);
    
    if (!response.ok) {
      throw new Error(`FHIR request failed: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  }
  
  async getPatient(patientId) {
    return this.request('GET', `/Patient/${patientId}`);
  }
  
  async searchPatients(params) {
    const queryString = new URLSearchParams(params).toString();
    return this.request('GET', `/Patient?${queryString}`);
  }
  
  async getPatientHistory(patientId) {
    // Get all relevant resources for a patient
    const resources = {};
    
    // Get conditions
    resources.conditions = await this.request('GET', `/Condition?patient=${patientId}`);
    
    // Get medications
    resources.medications = await this.request('GET', `/MedicationStatement?patient=${patientId}`);
    
    // Get allergies
    resources.allergies = await this.request('GET', `/AllergyIntolerance?patient=${patientId}`);
    
    // Get observations (vital signs, lab results)
    resources.observations = await this.request('GET', `/Observation?patient=${patientId}`);
    
    // Get procedures
    resources.procedures = await this.request('GET', `/Procedure?patient=${patientId}`);
    
    // Get past encounters
    resources.encounters = await this.request('GET', `/Encounter?patient=${patientId}`);
    
    return resources;
  }
  
  async createTriageEncounter(patientId, triageData) {
    // Create a new Encounter resource for the triage
    const encounter = {
      resourceType: 'Encounter',
      status: 'in-progress',
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'AMB',
        display: 'ambulatory'
      },
      type: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/encounter-type',
              code: 'ADMS',
              display: 'Triage'
            }
          ]
        }
      ],
      subject: {
        reference: `Patient/${patientId}`
      },
      participant: [
        {
          type: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
                  code: 'ATND',
                  display: 'attender'
                }
              ]
            }
          ],
          individual: {
            display: 'AI Triage System'
          }
        }
      ],
      period: {
        start: new Date().toISOString()
      }
    };
    
    return this.request('POST', '/Encounter', encounter);
  }
  
  async submitTriageResults(patientId, encounterId, triageResults) {
    // Create observations for symptoms
    const observations = triageResults.symptoms.map(symptom => ({
      resourceType: 'Observation',
      status: 'final',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'exam',
              display: 'Examination'
            }
          ]
        }
      ],
      code: {
        text: symptom.description
        // In a real system, we would use SNOMED CT or LOINC codes
      },
      subject: {
        reference: `Patient/${patientId}`
      },
      encounter: {
        reference: `Encounter/${encounterId}`
      },
      effectiveDateTime: new Date().toISOString(),
      valueString: symptom.details || 'Present'
    }));
    
    // Create a condition for the triage assessment
    const condition = {
      resourceType: 'Condition',
      clinicalStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
            code: 'active',
            display: 'Active'
          }
        ]
      },
      verificationStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
            code: 'provisional',
            display: 'Provisional'
          }
        ]
      },
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/condition-category',
              code: 'encounter-diagnosis',
              display: 'Encounter Diagnosis'
            }
          ]
        }
      ],
      code: {
        text: triageResults.assessment.mainCondition
        // In a real system, we would use ICD-10 or SNOMED CT codes
      },
      subject: {
        reference: `Patient/${patientId}`
      },
      encounter: {
        reference: `Encounter/${encounterId}`
      },
      recordedDate: new Date().toISOString(),
      note: [
        {
          text: triageResults.assessment.notes
        }
      ]
    };
    
    // Submit all resources
    const results = {
      observations: [],
      condition: null
    };
    
    // Submit observations
    for (const observation of observations) {
      const result = await this.request('POST', '/Observation', observation);
      results.observations.push(result);
    }
    
    // Submit condition
    results.condition = await this.request('POST', '/Condition', condition);
    
    // Update encounter with end time and status
    const updatedEncounter = {
      resourceType: 'Encounter',
      id: encounterId,
      status: 'finished',
      period: {
        start: triageResults.startTime,
        end: new Date().toISOString()
      }
    };
    
    results.encounter = await this.request('PUT', `/Encounter/${encounterId}`, updatedEncounter);
    
    return results;
  }
  
  mapPatientProfileToFHIR(profile) {
    // Convert our internal profile format to FHIR resources
    const patient = {
      resourceType: 'Patient',
      name: [
        {
          given: [profile.firstName],
          family: profile.lastName
        }
      ],
      gender: profile.demographics.gender,
      birthDate: profile.demographics.birthDate
    };
    
    const conditions = profile.medicalHistory.conditions.map(condition => ({
      resourceType: 'Condition',
      code: {
        text: condition.name
      },
      subject: {
        reference: 'Patient/' + profile.id
      },
      onsetDateTime: condition.onsetDate
    }));
    
    const medications = profile.medications.map(medication => ({
      resourceType: 'MedicationStatement',
      status: 'active',
      medicationCodeableConcept: {
        text: medication.name
      },
            subject: {
              reference: 'Patient/' + profile.id
            },
            effectiveDateTime: medication.startDate
          }));
      
          return {
            patient,
            conditions,
            medications
          };
        }
      }

      export const fetchPatientData = async () => {
        const apiUrl = process.env.REACT_APP_FHIR_API_URL;
        const token = localStorage.getItem('auth_token'); // Assume you store token after login
      
        if (!token) {
          console.error('No authentication token found.');
          return;  // Or show a message to the user
        }
      
        try {
          const response = await fetch(`${apiUrl}/Patient/123`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
      
          if (!response.ok) {
            throw new Error('Failed to fetch patient data');
          }
      
          const patientData = await response.json();
          return patientData;
      
        } catch (error) {
          console.error('Error fetching patient data:', error.message);
          // Handle error, show message to user, etc.
        }
      };
      