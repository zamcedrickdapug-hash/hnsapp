/**
 * useDashboardAPI Hook
 * ====================
 * Centralized API request management for all dashboards
 * Handles loading states, error handling, and request cancellation
 * 
 * Architecture Decision:
 * - Single hook for all dashboard API calls
 * - Built-in error handling and loading state management
 * - Request cancellation to prevent memory leaks
 * - Consistent API response handling
 * 
 * Benefits:
 * - Eliminates duplicate API call logic across dashboards
 * - Automatic loading/error state management
 * - Request cancellation on component unmount
 * - Standardized error handling
 * - Easy to add retry logic later
 */

import { useCallback, useRef, useEffect } from 'react'
import axios from 'axios'
import { useDashboardState } from './useDashboardState'
import { API_BASE_URL } from '../api'

/**
 * useDashboardAPI Hook
 * Provides reusable API request methods with error/loading handling
 * 
 * @returns {Object} API methods (get, post, put, delete, patch)
 */
export function useDashboardAPI() {
  const state = useDashboardState()
  const cancelTokenRef = useRef(null)

  // Create axios instance with base config
  const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
  })

  // Add auth token to requests if available
  api.interceptors.request.use(
    (config) => {
      if (config.url === '/api') {
        config.url = '/'
      } else if (config.url?.startsWith('/api/')) {
        config.url = config.url.slice(4)
      }
      const token = localStorage.getItem('token')
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
      return config
    },
    (error) => Promise.reject(error)
  )

  // Handle response errors globally
  api.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        // Unauthorized - redirect to login
        localStorage.removeItem('token')
        window.location.href = '/login'
      }
      return Promise.reject(error)
    }
  )

  /**
   * Generic API request handler
   * @param {string} method - HTTP method (get, post, put, delete, patch)
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request data (for POST, PUT, PATCH)
   * @param {Object} config - Additional axios config
   * @returns {Promise<Object>} API response data
   */
  const makeRequest = useCallback(
    async (method, endpoint, data = null, config = {}) => {
      try {
        state.setIsLoading(true)
        state.setError(null)

        const response = await api({
          method,
          url: endpoint,
          data,
          ...config,
        })

        state.setIsLoading(false)
        return response.data
      } catch (error) {
        state.setIsLoading(false)

        // Handle error response
        const errorMessage =
          error.response?.data?.message ||
          error.message ||
          'An error occurred. Please try again.'

        state.setError(errorMessage)
        console.error(`API Error [${method.toUpperCase()} ${endpoint}]:`, error)

        throw error
      }
    },
    [state]
  )

  /**
   * GET request
   * @param {string} endpoint - API endpoint
   * @param {Object} config - Additional axios config
   * @returns {Promise<Object>} Response data
   */
  const get = useCallback(
    (endpoint, config = {}) => makeRequest('get', endpoint, null, config),
    [makeRequest]
  )

  /**
   * POST request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request body
   * @param {Object} config - Additional axios config
   * @returns {Promise<Object>} Response data
   */
  const post = useCallback(
    (endpoint, data, config = {}) => makeRequest('post', endpoint, data, config),
    [makeRequest]
  )

  /**
   * PUT request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request body
   * @param {Object} config - Additional axios config
   * @returns {Promise<Object>} Response data
   */
  const put = useCallback(
    (endpoint, data, config = {}) => makeRequest('put', endpoint, data, config),
    [makeRequest]
  )

  /**
   * PATCH request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request body
   * @param {Object} config - Additional axios config
   * @returns {Promise<Object>} Response data
   */
  const patch = useCallback(
    (endpoint, data, config = {}) => makeRequest('patch', endpoint, data, config),
    [makeRequest]
  )

  /**
   * DELETE request
   * @param {string} endpoint - API endpoint
   * @param {Object} config - Additional axios config
   * @returns {Promise<Object>} Response data
   */
  const del = useCallback(
    (endpoint, config = {}) => makeRequest('delete', endpoint, null, config),
    [makeRequest]
  )

  /**
   * Batch fetch data from multiple endpoints
   * @param {Array<string>} endpoints - Array of endpoints to fetch
   * @returns {Promise<Array>} Array of responses
   */
  const fetchBatch = useCallback(
    async (endpoints) => {
      try {
        state.setIsLoading(true)
        state.setError(null)

        const responses = await Promise.all(endpoints.map((endpoint) => api.get(endpoint)))

        state.setIsLoading(false)
        return responses.map((r) => r.data)
      } catch (error) {
        state.setIsLoading(false)
        state.setError(error.message)
        throw error
      }
    },
    [state]
  )

  /**
   * Upload file (multipart/form-data)
   * @param {string} endpoint - API endpoint
   * @param {FormData} formData - Form data with files
   * @returns {Promise<Object>} Response data
   */
  const uploadFile = useCallback(
    async (endpoint, formData, onProgress) => {
      try {
        state.setIsLoading(true)
        state.setError(null)

        const response = await api.post(endpoint, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            if (onProgress) {
              onProgress((progressEvent.loaded / progressEvent.total) * 100)
            }
          },
        })

        state.setIsLoading(false)
        return response.data
      } catch (error) {
        state.setIsLoading(false)
        state.setError(error.message)
        throw error
      }
    },
    [state]
  )

  /**
   * Request with retry logic
   * @param {Function} requestFn - Request function to retry
   * @param {number} retries - Number of retries (default: 3)
   * @returns {Promise<Object>} Response data
   */
  const requestWithRetry = useCallback(
    async (requestFn, retries = 3) => {
      for (let i = 0; i < retries; i++) {
        try {
          return await requestFn()
        } catch (error) {
          if (i === retries - 1) throw error
          // Exponential backoff
          await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, i)))
        }
      }
    },
    []
  )

  // Cleanup cancel tokens on unmount
  useEffect(() => {
    return () => {
      if (cancelTokenRef.current) {
        cancelTokenRef.current.cancel('Component unmounted')
      }
    }
  }, [])

  return {
    get,
    post,
    put,
    patch,
    delete: del,
    fetchBatch,
    uploadFile,
    requestWithRetry,
    isLoading: state.isLoading,
    error: state.error,
    setError: state.setError,
    clearError: state.clearError,
  }
}

export default useDashboardAPI
