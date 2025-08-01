import { useState, useCallback, useRef } from 'react'

export interface LoadingState {
  isLoading: boolean
  error: string | null
  lastUpdated: Date | null
}

export interface UseLoadingStateOptions {
  initialLoading?: boolean
  timeout?: number
  onTimeout?: () => void
}

export const useLoadingState = (options: UseLoadingStateOptions = {}) => {
  const {
    initialLoading = false,
    timeout = 30000, // 30 seconds default timeout
    onTimeout
  } = options

  const [state, setState] = useState<LoadingState>({
    isLoading: initialLoading,
    error: null,
    lastUpdated: null
  })

  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({
      ...prev,
      isLoading: loading,
      error: loading ? null : prev.error, // Clear error when starting to load
      lastUpdated: loading ? prev.lastUpdated : new Date()
    }))

    // Handle timeout
    if (loading && timeout > 0) {
      timeoutRef.current = setTimeout(() => {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Operation timed out'
        }))
        onTimeout?.()
      }, timeout)
    } else if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [timeout, onTimeout])

  const setError = useCallback((error: string | null) => {
    setState(prev => ({
      ...prev,
      error,
      isLoading: false,
      lastUpdated: new Date()
    }))

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: null
    }))
  }, [])

  const reset = useCallback(() => {
    setState({
      isLoading: false,
      error: null,
      lastUpdated: null
    })

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const withLoading = useCallback(async <T,>(
    asyncFn: () => Promise<T>,
    errorHandler?: (error: any) => string
  ): Promise<T | null> => {
    try {
      setLoading(true)
      const result = await asyncFn()
      setLoading(false)
      return result
    } catch (error) {
      const errorMessage = errorHandler 
        ? errorHandler(error)
        : error instanceof Error 
          ? error.message 
          : 'An error occurred'
      setError(errorMessage)
      return null
    }
  }, [setLoading, setError])

  return {
    ...state,
    setLoading,
    setError,
    clearError,
    reset,
    withLoading
  }
}

// Hook for managing multiple loading states
export const useLoadingStates = () => {
  const [states, setStates] = useState<Record<string, LoadingState>>({})

  const getState = useCallback((key: string): LoadingState => {
    return states[key] || {
      isLoading: false,
      error: null,
      lastUpdated: null
    }
  }, [states])

  const setLoading = useCallback((key: string, loading: boolean) => {
    setStates(prev => ({
      ...prev,
      [key]: {
        isLoading: loading,
        error: loading ? null : prev[key]?.error || null,
        lastUpdated: loading ? prev[key]?.lastUpdated || null : new Date()
      }
    }))
  }, [])

  const setError = useCallback((key: string, error: string | null) => {
    setStates(prev => ({
      ...prev,
      [key]: {
        isLoading: false,
        error,
        lastUpdated: new Date()
      }
    }))
  }, [])

  const clearError = useCallback((key: string) => {
    setStates(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        error: null
      }
    }))
  }, [])

  const reset = useCallback((key?: string) => {
    if (key) {
      setStates(prev => {
        const newStates = { ...prev }
        delete newStates[key]
        return newStates
      })
    } else {
      setStates({})
    }
  }, [])

  const withLoading = useCallback(async <T,>(
    key: string,
    asyncFn: () => Promise<T>,
    errorHandler?: (error: any) => string
  ): Promise<T | null> => {
    try {
      setLoading(key, true)
      const result = await asyncFn()
      setLoading(key, false)
      return result
    } catch (error) {
      const errorMessage = errorHandler 
        ? errorHandler(error)
        : error instanceof Error 
          ? error.message 
          : 'An error occurred'
      setError(key, errorMessage)
      return null
    }
  }, [setLoading, setError])

  const isAnyLoading = useCallback(() => {
    return Object.values(states).some(state => state.isLoading)
  }, [states])

  const getAllErrors = useCallback(() => {
    return Object.entries(states)
      .filter(([, state]) => state.error)
      .map(([key, state]) => ({ key, error: state.error! }))
  }, [states])

  return {
    states,
    getState,
    setLoading,
    setError,
    clearError,
    reset,
    withLoading,
    isAnyLoading,
    getAllErrors
  }
}

// Specialized hook for API operations
export const useApiLoadingState = () => {
  const { withLoading, ...rest } = useLoadingState({
    timeout: 60000, // 1 minute timeout for API calls
    onTimeout: () => {
      console.warn('API operation timed out')
    }
  })

  const withApiLoading = useCallback(async <T,>(
    operation: () => Promise<T>,
    operationName = 'API operation'
  ): Promise<T | null> => {
    return withLoading(operation, (error) => {
      // Handle different types of API errors
      if (error.code === 'NETWORK_ERROR') {
        return `Network error during ${operationName}. Please check your connection.`
      } else if (error.code === 'TIMEOUT') {
        return `${operationName} timed out. Please try again.`
      } else if (error.code === 'UNAUTHORIZED') {
        return `Authentication required for ${operationName}.`
      } else if (error.message) {
        return `${operationName} failed: ${error.message}`
      } else {
        return `${operationName} failed with an unknown error.`
      }
    })
  }, [withLoading])

  return {
    ...rest,
    withApiLoading
  }
}