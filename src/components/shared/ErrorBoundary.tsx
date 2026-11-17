import React, { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertCircle, RotateCcw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('StockFlow Pro Uncaught Error:', error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F4F7FA] flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-6 text-center shadow-lg border border-[#DCE5EB] bg-white rounded-2xl">
            <div className="w-14 h-14 rounded-full bg-red-50 text-[#DC4C4C] flex items-center justify-center mx-auto mb-4 border border-red-200">
              <AlertCircle className="w-8 h-8" />
            </div>

            <h1 className="text-lg font-bold text-[#102C42] mb-1">Application Error</h1>
            <p className="text-xs text-[#72869A] mb-4">
              VM Stock encountered an unexpected issue while rendering this view.
            </p>

            {this.state.error && (
              <div className="p-3 bg-red-50/60 rounded-xl border border-red-200 text-left mb-5">
                <p className="text-xs font-mono text-[#DC4C4C] font-semibold break-words">
                  {this.state.error.message || 'Unknown runtime error'}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="btn-primary text-xs flex items-center justify-center gap-1.5 py-2.5"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reload Page</span>
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
