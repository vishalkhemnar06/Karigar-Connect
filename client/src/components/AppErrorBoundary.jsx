import React from 'react';
import { Link } from 'react-router-dom';

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || 'Something went wrong.',
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error('AppErrorBoundary caught:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-orange-100 rounded-2xl shadow-lg p-6 text-center">
            <h1 className="text-xl font-black text-orange-700 mb-2">Something went wrong</h1>
            <p className="text-sm text-gray-600 mb-1">The page hit an unexpected error.</p>
            <p className="text-xs text-gray-400 mb-5 break-words">{this.state.errorMessage}</p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={this.handleRetry}
                className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold"
              >
                Try Again
              </button>
              <Link
                to="/home"
                className="px-4 py-2 rounded-xl border border-orange-200 text-orange-700 hover:bg-orange-50 text-sm font-bold"
              >
                Go Home
              </Link>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-bold"
              >
                Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AppErrorBoundary;
