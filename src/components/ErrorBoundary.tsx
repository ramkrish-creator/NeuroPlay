import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught application error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center p-6 bg-slate-950 text-slate-100">
          <div className="glass-panel max-w-lg w-full p-8 text-center space-y-6 border-red-900/40 shadow-2xl rounded-3xl">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
              <AlertTriangle size={32} />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold font-display text-white">NeuroPlay needs to reload</h2>
              <p className="text-sm text-slate-400">
                An unexpected interface error occurred. Previously saved NeuroPlay data remains in this browser.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-slate-900/80 rounded-xl text-left text-xs font-mono text-red-300 overflow-x-auto border border-slate-800">
                {this.state.error.message}
              </div>
            )}

            <button
              onClick={this.handleReset}
              className="w-full py-3.5 px-6 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm font-display tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-500/20"
            >
              <RotateCcw size={16} /> Reload NeuroPlay
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
