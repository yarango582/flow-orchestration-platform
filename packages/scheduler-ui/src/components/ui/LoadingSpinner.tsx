import React from 'react'
import { clsx } from 'clsx'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  color?: 'primary' | 'secondary' | 'white' | 'gray'
  text?: string
  overlay?: boolean
  className?: string
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  color = 'primary',
  text,
  overlay = false,
  className
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12'
  }

  const colorClasses = {
    primary: 'text-blue-600',
    secondary: 'text-gray-600',
    white: 'text-white',
    gray: 'text-gray-400'
  }

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl'
  }

  const spinner = (
    <div className={clsx('flex items-center justify-center', className)}>
      <div className="flex flex-col items-center space-y-2">
        <svg
          className={clsx(
            'animate-spin',
            sizeClasses[size],
            colorClasses[color]
          )}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        {text && (
          <span className={clsx(
            'font-medium',
            textSizeClasses[size],
            colorClasses[color]
          )}>
            {text}
          </span>
        )}
      </div>
    </div>
  )

  if (overlay) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 shadow-xl">
          {spinner}
        </div>
      </div>
    )
  }

  return spinner
}

export default LoadingSpinner

// Specialized loading components
export const PageLoadingSpinner: React.FC<{ text?: string }> = ({ text = 'Loading...' }) => (
  <div className="min-h-[400px] flex items-center justify-center">
    <LoadingSpinner size="lg" text={text} />
  </div>
)

export const ButtonLoadingSpinner: React.FC<{ size?: 'sm' | 'md' }> = ({ size = 'sm' }) => (
  <LoadingSpinner size={size} color="white" className="mr-2" />
)

export const InlineLoadingSpinner: React.FC<{ text?: string }> = ({ text }) => (
  <div className="flex items-center space-x-2 py-2">
    <LoadingSpinner size="sm" color="secondary" />
    {text && <span className="text-sm text-gray-600">{text}</span>}
  </div>
)

export const OverlayLoadingSpinner: React.FC<{ text?: string }> = ({ text = 'Loading...' }) => (
  <LoadingSpinner size="lg" text={text} overlay />
)