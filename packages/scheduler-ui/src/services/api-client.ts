/**
 * Main API client for the Flow Platform
 * Handles HTTP requests to all backend services with proper error handling and retries
 */

import { ApiError } from '@/types/api'

export interface ApiClientConfig {
  baseUrl: string
  authToken?: string
  timeout?: number
  retries?: number
}

export class ApiClient {
  private config: ApiClientConfig
  private abortController: AbortController

  constructor(config: ApiClientConfig) {
    this.config = {
      timeout: 30000,
      retries: 3,
      ...config
    }
    this.abortController = new AbortController()
  }

  /**
   * Generic HTTP request method with error handling and retries
   */
  private async request<T>(
    url: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<T> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers
      }

      if (this.config.authToken) {
        headers.Authorization = `Bearer ${this.config.authToken}`
      }

      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const apiError: ApiError = {
          code: errorData.code || `HTTP_${response.status}`,
          message: errorData.message || response.statusText,
          details: errorData.details,
          timestamp: new Date().toISOString()
        }
        throw apiError
      }

      // Handle empty responses (204 No Content, etc.)
      if (response.status === 204 || response.headers.get('content-length') === '0') {
        return undefined as T
      }

      // Check if response has content to parse
      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('application/json')) {
        return await response.json()
      }

      // If no JSON content, return empty response
      return undefined as T
    } catch (error) {
      clearTimeout(timeoutId)

      // Retry logic for network errors
      if (
        retryCount < (this.config.retries || 0) &&
        (error instanceof TypeError || // Network error
          (error as ApiError).code?.includes('TIMEOUT'))
      ) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000))
        return this.request<T>(url, options, retryCount + 1)
      }

      throw error
    }
  }

  /**
   * GET request
   */
  async get<T>(url: string, params?: Record<string, any>): Promise<T> {
    let requestUrl = url
    if (params) {
      const searchParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value))
        }
      })
      if (searchParams.toString()) {
        requestUrl += `?${searchParams.toString()}`
      }
    }

    return this.request<T>(requestUrl, { method: 'GET' })
  }

  /**
   * POST request
   */
  async post<T>(url: string, data?: any): Promise<T> {
    return this.request<T>(url, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    })
  }

  /**
   * PUT request
   */
  async put<T>(url: string, data?: any): Promise<T> {
    return this.request<T>(url, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined
    })
  }

  /**
   * DELETE request
   */
  async delete<T>(url: string): Promise<T> {
    return this.request<T>(url, { method: 'DELETE' })
  }

  /**
   * Update authentication token
   */
  setAuthToken(token: string) {
    this.config.authToken = token
  }

  /**
   * Get API URL
   */
  getUrl(path: string): string {
    return `${this.config.baseUrl}${path}`
  }

  /**
   * Cancel all pending requests
   */
  cancelRequests() {
    this.abortController.abort()
    this.abortController = new AbortController()
  }
}

// Default API client instance
export const apiClient = new ApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1'
})