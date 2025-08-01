import React, { Component, ErrorInfo, ReactNode } from 'react'
import { ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorId: string
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: (error: Error, errorInfo: ErrorInfo, retry: () => void) => ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  showDetails?: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorId: Date.now().toString(36)
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    })

    // Log error to console in development
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught an error:', error, errorInfo)
    }

    // Call custom error handler
    this.props.onError?.(error, errorInfo)

    // In production, you might want to send this to an error reporting service
    if (import.meta.env.PROD) {
      // Example: Sentry, LogRocket, etc.
      // errorReportingService.captureException(error, { extra: errorInfo })
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback && this.state.error && this.state.errorInfo) {
        return this.props.fallback(this.state.error, this.state.errorInfo, this.handleRetry)
      }

      return (
        <DefaultErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          errorId={this.state.errorId}
          onRetry={this.handleRetry}
          showDetails={this.props.showDetails}
        />
      )
    }

    return this.props.children
  }
}

interface DefaultErrorFallbackProps {
  error: Error | null
  errorInfo: ErrorInfo | null
  errorId: string
  onRetry: () => void
  showDetails?: boolean
}

const DefaultErrorFallback: React.FC<DefaultErrorFallbackProps> = ({
  error,
  errorInfo,
  errorId,
  onRetry,
  showDetails = false
}) => {
  const [detailsExpanded, setDetailsExpanded] = React.useState(false)

  const copyErrorDetails = () => {
    const errorDetails = {
      errorId,
      message: error?.message,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      timestamp: new Date().toISOString()
    }

    navigator.clipboard.writeText(JSON.stringify(errorDetails, null, 2))
      .then(() => alert('Error details copied to clipboard'))
      .catch(() => console.error('Failed to copy error details'))
  }

  return (
    <div className="min-h-[400px] flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white border border-red-200 rounded-lg shadow-lg p-6">
        <div className="flex items-center space-x-3 mb-4">
          <ExclamationTriangleIcon className="w-8 h-8 text-red-500 flex-shrink-0" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Something went wrong</h2>
            <p className="text-sm text-gray-600">
              An unexpected error occurred. Please try refreshing the page.
            </p>
          </div>
        </div>

        {error?.message && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700 font-medium">{error.message}</p>
          </div>
        )}

        <div className="flex flex-col space-y-3">
          <button
            onClick={onRetry}
            className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <ArrowPathIcon className="w-4 h-4 mr-2" />
            Try Again
          </button>

          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Refresh Page
          </button>

          {(showDetails || import.meta.env.DEV) && (
            <div className="border-t pt-3">
              <button
                onClick={() => setDetailsExpanded(!detailsExpanded)}
                className="text-sm text-gray-500 hover:text-gray-700 mb-2"
              >
                {detailsExpanded ? 'Hide' : 'Show'} Error Details
              </button>

              {detailsExpanded && (
                <div className="space-y-2">
                  <div className="text-xs text-gray-500">
                    Error ID: <code className="bg-gray-100 px-1 rounded">{errorId}</code>
                  </div>
                  
                  {error?.stack && (
                    <div className="max-h-32 overflow-y-auto bg-gray-50 p-2 rounded text-xs font-mono text-gray-700">
                      <pre>{error.stack}</pre>
                    </div>
                  )}

                  <button
                    onClick={copyErrorDetails}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    Copy Error Details
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 pt-3 border-t text-xs text-gray-500">
          If this problem persists, please contact support with Error ID: {errorId}
        </div>
      </div>
    </div>
  )
}

// Hook for using error boundary programmatically
export const useErrorBoundary = () => {
  const [error, setError] = React.useState<Error | null>(null)

  const resetError = React.useCallback(() => {
    setError(null)
  }, [])

  const captureError = React.useCallback((error: Error) => {
    setError(error)
  }, [])

  React.useEffect(() => {
    if (error) {
      throw error
    }
  }, [error])

  return { captureError, resetError }
}

export default ErrorBoundary