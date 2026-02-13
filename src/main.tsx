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

// Display error function - must be defined before any async operations
function displayFatalError(error: unknown, phase: string) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : '';
  console.error(`[Fatal Error - ${phase}]`, error);

  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; font-family: system-ui, -apple-system, sans-serif; background: linear-gradient(135deg, #f8fafc 0%, #eef2ff 50%, #faf5ff 100%);">
        <div style="background: white; padding: 40px; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); max-width: 600px; text-align: center;">
          <div style="width: 64px; height: 64px; background: #fef2f2; border-radius: 16px; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 8v4M12 16h.01"/>
            </svg>
          </div>
          <h1 style="color: #0f172a; font-size: 24px; font-weight: 700; margin: 0 0 8px;">Failed to Load Application</h1>
          <p style="color: #64748b; margin: 0 0 16px; font-size: 14px;">Error during: ${phase}</p>
          <pre style="background: #f8fafc; padding: 16px; border-radius: 8px; text-align: left; overflow: auto; font-size: 12px; color: #475569; margin: 0 0 16px; border: 1px solid #e2e8f0; white-space: pre-wrap; word-break: break-word;">${message}${stack ? '\n\n' + stack : ''}</pre>
          <button onclick="window.location.reload()" style="padding: 12px 24px; background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px;">
            Reload Page
          </button>
        </div>
      </div>
    `;
  }
}

// Global error handlers - set up immediately
window.onerror = function(message, source, lineno, colno, error) {
  console.error('[Global Error]', { message, source, lineno, colno, error });
  displayFatalError(error || message, 'Runtime Error');
  return false;
};

window.onunhandledrejection = function(event) {
  console.error('[Unhandled Promise Rejection]', event.reason);
  displayFatalError(event.reason, 'Unhandled Promise');
};

// Helper to update loading status in the UI
function updateLoadingStatus(step: string) {
  const loadingContent = document.querySelector('.app-loading-content p');
  if (loadingContent) {
    loadingContent.textContent = step;
  }
  console.log(`[Bootstrap] ${step}`);
}

// Main bootstrap function using dynamic imports
async function bootstrap() {
  try {
    console.log('[Bootstrap] Starting application at:', new Date().toISOString());
    updateLoadingStatus('Starting...');

    // Import React first
    updateLoadingStatus('Loading React...');
    const React = await import('react');
    const { createRoot } = await import('react-dom/client');
    updateLoadingStatus('React loaded');

    // Import React Query
    updateLoadingStatus('Loading React Query...');
    const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
    updateLoadingStatus('React Query loaded');

    // Import Para SDK
    updateLoadingStatus('Loading Para SDK...');
    const { ParaProvider, Environment } = await import('@getpara/react-sdk');
    await import('@getpara/react-sdk/styles.css');
    updateLoadingStatus('Para SDK loaded');

    // Import app components
    updateLoadingStatus('Loading app components...');
    const { PermissionProvider } = await import('./contexts/PermissionContext');
    const { default: App } = await import('./App');
    await import('./index.css');
    updateLoadingStatus('App components loaded');

    // Get API key and environment
    const PARA_API_KEY = import.meta.env.VITE_PARA_API_KEY || '';
    const PARA_ENV = import.meta.env.VITE_PARA_ENV || 'development';

    // Determine Para environment - 'production' uses PROD, everything else uses BETA
    const paraEnv = PARA_ENV === 'production' ? Environment.PROD : Environment.BETA;

    if (!PARA_API_KEY) {
      console.error('[Para] CRITICAL: No API key found!');
      console.error('[Para] Set VITE_PARA_API_KEY in environment variables');
      console.error('[Para] For Vercel: Add VITE_PARA_API_KEY in Settings → Environment Variables');
      // Show visible warning
      const warningDiv = document.createElement('div');
      warningDiv.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#fef2f2;color:#991b1b;padding:12px;text-align:center;z-index:9999;font-size:14px;';
      warningDiv.innerHTML = '<strong>Warning:</strong> Para API key not configured. Login will not work. Set VITE_PARA_API_KEY in environment.';
      document.body.prepend(warningDiv);
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
          return React.createElement('div', {
            style: {
              padding: '40px',
              textAlign: 'center',
              fontFamily: 'Inter, system-ui, sans-serif',
              minHeight: '100vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 50%, #faf5ff 100%)'
            }
          }, React.createElement('div', {
            style: {
              background: 'white',
              padding: '40px',
              borderRadius: '16px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
              maxWidth: '500px',
              width: '100%'
            }
          }, [
            React.createElement('h1', { key: 'title', style: { color: '#ef4444', marginBottom: '16px' } }, 'Application Error'),
            React.createElement('pre', {
              key: 'error',
              style: {
                background: '#f8fafc',
                padding: '16px',
                borderRadius: '8px',
                textAlign: 'left',
                overflow: 'auto',
                fontSize: '12px',
                marginBottom: '16px'
              }
            }, this.state.error?.message || 'Unknown error'),
            React.createElement('button', {
              key: 'reload',
              onClick: () => window.location.reload(),
              style: {
                padding: '12px 24px',
                background: '#6366f1',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer'
              }
            }, 'Reload')
          ]));
        }
        return this.props.children;
      }
    }

    // Render the app
    updateLoadingStatus('Rendering application...');

    // Para modal configuration
    // @see https://docs.getpara.com/v2/react/guides/customization/modal
    const paraModalConfig = {
      theme: {
        mode: 'light' as const,
        accentColor: '#6366f1', // Primary color
      },
      logo: undefined, // Use default Para logo
      recoverySecretStepEnabled: true,
      disableEmailLogin: false,
      disablePhoneLogin: false,
    };

    createRoot(rootElement).render(
      React.createElement(React.StrictMode, null,
        React.createElement(ErrorBoundary, null,
          React.createElement(QueryClientProvider, { client: queryClient },
            React.createElement(ParaProvider, {
              paraClientConfig: {
                apiKey: PARA_API_KEY,
                env: paraEnv,
              },
              config: {
                appName: 'Para Allowance Wallet',
              },
              paraModalConfig,
            },
              React.createElement(PermissionProvider, null,
                React.createElement(App, null)
              )
            )
          )
        )
      )
    );

    console.log('[Bootstrap] Application rendered successfully');

    // Clear the timeout set in index.html since app loaded successfully
    if (typeof window !== 'undefined' && (window as unknown as { __appLoadTimeout?: ReturnType<typeof setTimeout> }).__appLoadTimeout) {
      clearTimeout((window as unknown as { __appLoadTimeout: ReturnType<typeof setTimeout> }).__appLoadTimeout);
    }

  } catch (error) {
    console.error('[Bootstrap] Failed to initialize:', error);
    displayFatalError(error, 'Initialization');
  }
}

// Start the application
bootstrap();
