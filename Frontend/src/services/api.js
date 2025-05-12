// src/services/api.js
// This file handles the API communication with our backend

/**
 * Base API configuration
 */
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL ;
const API_TIMEOUT = 30000; // 30 secondsss

/**
 * Helper function to handle API responses
 * @param {Response} response - Fetch API response
 * @returns {Promise} - Resolved promise with data or rejected with error
 */
const handleResponse = async (response) => {
  if (!response.ok) {
    // Get error details from response if available
    try {
      const errorData = await response.json();
      throw new Error(errorData.message || `API error: ${response.status}`);
    } catch (e) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
  }
  
  // Check if response is empty
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.indexOf("application/json") !== -1) {
    return response.json();
  } else {
    return response.text();
  }
};

/**
 * Fetch with timeout
 * @param {string} url - API endpoint
 * @param {Object} options - Fetch options
 * @returns {Promise} - Promise with fetch result or timeout error
 */
const fetchWithTimeout = (url, options = {}) => {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), API_TIMEOUT)
    )
  ]);
};

/**
 * API request methods
 */
export const api = {
  /**
   * GET request
   * @param {string} endpoint - API endpoint
   * @param {Object} params - URL parameters
   * @returns {Promise} - Promise with response data
   */
  async get(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = `${API_BASE_URL}/${endpoint}${queryString ? `?${queryString}` : ''}`;
    
    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      credentials: 'include',
    });
    
    return handleResponse(response);
  },
  
  /**
   * POST request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request body data
   * @returns {Promise} - Promise with response data
   */
  async post(endpoint, data = {}) {
    const url = `${API_BASE_URL}/${endpoint}`;
    
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    
    return handleResponse(response);
  },
  
  /**
   * PUT request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request body data
   * @returns {Promise} - Promise with response data
   */
  async put(endpoint, data = {}) {
    const url = `${API_BASE_URL}/${endpoint}`;
    
    const response = await fetchWithTimeout(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    
    return handleResponse(response);
  },
  
  /**
   * DELETE request
   * @param {string} endpoint - API endpoint
   * @returns {Promise} - Promise with response data
   */
  async delete(endpoint) {
    const url = `${API_BASE_URL}/${endpoint}`;
    
    const response = await fetchWithTimeout(url, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
      },
      credentials: 'include',
    });
    
    return handleResponse(response);
  }
};
