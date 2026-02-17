/**
 * Para Allowance Wallet - Entry Point
 *
 * Sets up the React application with:
 * - React Query for data management (required by Para SDK)
 * - ParaProvider for Para SDK integration
 * - PermissionProvider for local permission management
 *
 * @see https://www.getpara.com/
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ParaProvider, Environment } from '@getpara/react-sdk';
import '@getpara/react-sdk/styles.css';
import { PermissionProvider } from './contexts/PermissionContext';
import App from './App';
import './index.css';

// Get API key and environment
const PARA_API_KEY = import.meta.env.VITE_PARA_API_KEY || '';
const PARA_ENV = import.meta.env.VITE_PARA_ENV || 'development';

// Determine Para environment - 'production' uses PROD, everything else uses BETA
const paraEnv = PARA_ENV === 'production' ? Environment.PROD : Environment.BETA;

if (!PARA_API_KEY) {
  console.error('[Para] CRITICAL: No API key found!');
  console.error('[Para] Set VITE_PARA_API_KEY in environment variables');
  console.error('[Para] For Vercel: Add VITE_PARA_API_KEY in Settings → Environment Variables');
} else {
  console.log('[Para] API key loaded successfully:', {
    env: PARA_ENV,
    keyPrefix: PARA_API_KEY.substring(0, 10) + '...',
    keyLength: PARA_API_KEY.length,
  });
}

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

// Get root element
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[Error Boundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          fontFamily: 'Inter, system-ui, sans-serif',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 50%, #faf5ff 100%)'
        }}>
          <div style={{
            background: 'white',
            padding: '40px',
            borderRadius: '16px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
            maxWidth: '500px',
            width: '100%'
          }}>
            <h1 style={{ color: '#ef4444', marginBottom: '16px' }}>Application Error</h1>
            <pre style={{
              background: '#f8fafc',
              padding: '16px',
              borderRadius: '8px',
              textAlign: 'left',
              overflow: 'auto',
              fontSize: '12px',
              marginBottom: '16px'
            }}>
              {this.state.error?.message || 'Unknown error'}
            </pre>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '12px 24px',
                background: '#6366f1',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Para modal configuration
// @see https://docs.getpara.com/v2/react/guides/customization/modal
const paraModalConfig = {
  theme: {
    mode: 'light' as const,
    accentColor: '#6366f1',
  },
  logo: undefined,
  recoverySecretStepEnabled: true,
  disableEmailLogin: false,
  disablePhoneLogin: false,
};

// Para event callbacks for debugging auth issues
const paraCallbacks = {
  onLogin: (event: unknown) => {
    console.log('[Para] Login event:', event);
  },
  onAccountCreation: (event: unknown) => {
    console.log('[Para] Account creation event:', event);
  },
  onAccountSetup: (event: unknown) => {
    console.log('[Para] Account setup event:', event);
  },
  onLogout: (event: unknown) => {
    console.log('[Para] Logout event:', event);
  },
};

// Render the app
createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ParaProvider
          paraClientConfig={{
            apiKey: PARA_API_KEY,
            env: paraEnv,
          }}
          config={{
            appName: 'Para Allowance Wallet',
          }}
          paraModalConfig={paraModalConfig}
          callbacks={paraCallbacks}
        >
          <PermissionProvider>
            <App />
          </PermissionProvider>
        </ParaProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
