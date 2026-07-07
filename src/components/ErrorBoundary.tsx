import { Component, type ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';

// Catches render-time errors in its children so a bug in one screen shows a
// friendly "reload" message instead of blanking the whole app. React only lets
// you catch render errors from a class component (there's no hook for it), which
// is why this one file is a class.

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  // React calls this when a child throws while rendering; whatever we return
  // becomes the new state, which flips us into the fallback UI.
  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  // Fires alongside the above — a good spot to log the error for debugging.
  componentDidCatch(error: Error) {
    console.error('Auros hit a render error:', error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="center" style={{ flexDirection: 'column', gap: 14, padding: 24, textAlign: 'center' }}>
          <TriangleAlert size={34} color="var(--danger)" />
          <div style={{ fontWeight: 700, fontSize: 18 }}>Something went wrong</div>
          <div className="muted" style={{ maxWidth: 340, fontSize: 14, lineHeight: 1.5 }}>
            Auros hit an unexpected error on this screen. Reloading usually clears it.
          </div>
          <button className="btn btn-primary" style={{ marginTop: 4 }} onClick={() => window.location.reload()}>
            Reload Auros
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
