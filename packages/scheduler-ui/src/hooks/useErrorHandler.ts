import { useCallback } from 'react'
import { toast } from 'react-hot-toast'
import { ApiError } from '@/types/api'

export interface ErrorHandlerOptions {
  title?: string
  showToast?: boolean
  logError?: boolean
  onError?: (error: any) => void
}

export const useErrorHandler = () => {
  const handleError = useCallback((
    error: any, 
    options: ErrorHandlerOptions = {}
  ) => {
    const {
      title = 'Error',
      showToast = true,
      logError = true,
      onError
    } = options

    // Log error to console in development
    if (logError && import.meta.env.DEV) {
      console.error('Error handled:', error)
    }

    // Determine error message
    let message = 'An unexpected error occurred'
    let code = 'UNKNOWN_ERROR'

    if (error instanceof Error) {
      message = error.message
    } else if (typeof error === 'string') {
      message = error
    } else if (error && typeof error === 'object') {
      // Handle API errors
      const apiError = error as ApiError
      if (apiError.message) {
        message = apiError.message
        code = apiError.code || 'API_ERROR'
      }
    }

    // Show toast notification
    if (showToast) {
      const toastMessage = title === 'Error' ? message : `${title}: ${message}`
      
      // Different toast types based on error code
      if (code.includes('NETWORK') || code.includes('TIMEOUT')) {
        toast.error(`Network Error: ${message}`, {
          duration: 5000,
          icon: '🌐',
        })
      } else if (code.includes('AUTH') || code.includes('UNAUTHORIZED')) {
        toast.error(`Authentication Error: ${message}`, {
          duration: 6000,
          icon: '🔒',
        })
      } else if (code.includes('VALIDATION')) {
        toast.error(`Validation Error: ${message}`, {
          duration: 4000,
          icon: '⚠️',
        })
      } else {
        toast.error(toastMessage, {
          duration: 4000,
        })
      }
    }

    // Custom error callback
    if (onError) {
      onError(error)
    }

    // Return normalized error info
    return {
      message,
      code,
      originalError: error
    }
  }, [])

  const handleAsyncError = useCallback(async <T>(
    asyncFn: () => Promise<T>,
    options?: ErrorHandlerOptions
  ): Promise<T | null> => {
    try {
      return await asyncFn()
    } catch (error) {
      handleError(error, options)
      return null
    }
  }, [handleError])

  const withErrorHandling = useCallback(<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    options?: ErrorHandlerOptions
  ) => {
    return async (...args: T): Promise<R | null> => {
      try {
        return await fn(...args)
      } catch (error) {
        handleError(error, options)
        return null
      }
    }
  }, [handleError])

  return {
    handleError,
    handleAsyncError,
    withErrorHandling
  }
}

// Hook for handling specific error types
export const useApiErrorHandler = () => {
  const { handleError } = useErrorHandler()

  const handleApiError = useCallback((error: any, operation = 'operation') => {
    return handleError(error, {
      title: `Failed to ${operation}`,
      showToast: true,
      logError: true
    })
  }, [handleError])

  const handleNetworkError = useCallback((error: any) => {
    return handleError(error, {
      title: 'Network Error',
      showToast: true,
      logError: true
    })
  }, [handleError])

  const handleValidationError = useCallback((error: any) => {
    return handleError(error, {
      title: 'Validation Error',
      showToast: true,
      logError: false // Usually expected errors
    })
  }, [handleError])

  return {
    handleApiError,
    handleNetworkError,
    handleValidationError
  }
}