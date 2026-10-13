import { StrictMode, Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class RootErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[Root Error]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1e293b',
          color: '#f8fafc',
          padding: '2rem',
          fontFamily: 'monospace'
        }}>
          <div style={{
            maxWidth: '600px',
            backgroundColor: '#0f172a',
            border: '1px solid #ef4444',
            borderRadius: '12px',
            padding: '24px'
          }}>
            <h2 style={{ color: '#ef4444', margin: '0 0 12px 0', fontSize: '18px' }}>
              Sage Bot Runtime Error
            </h2>
            <p style={{ fontSize: '14px', color: '#cbd5e1', marginBottom: '16px' }}>
              {this.state.error?.message ?? 'An unknown error occurred'}
            </p>
            <pre style={{
              background: '#020617',
              padding: '12px',
              borderRadius: '6px',
              fontSize: '12px',
              overflowX: 'auto',
              color: '#94a3b8'
            }}>
              {this.state.error?.stack}
            </pre>
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: '16px',
                padding: '8px 16px',
                backgroundColor: '#0d9488',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
);

