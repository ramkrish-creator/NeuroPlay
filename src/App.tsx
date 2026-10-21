import { ErrorBoundary } from './components/ErrorBoundary';
import { NeuroPlayApp } from './neuroplay/NeuroPlayApp';

export default function App() {
  return (
    <ErrorBoundary>
      <NeuroPlayApp />
    </ErrorBoundary>
  );
}
