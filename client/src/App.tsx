import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { RoomPage } from './pages/RoomPage';
import { NotFoundPage } from './pages/NotFoundPage';
import DiscoverPage from './pages/DiscoverPage';
import { ServersPage } from './pages/ServersPage';
import { DMPage } from './pages/DMPage';
import { SettingsPage } from './pages/SettingsPage';
import { Toaster } from './components/ui/Toast';
import { ErrorBoundary } from './components/error/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/discover" element={<DiscoverPage />} />
          <Route path="/room/:code" element={<RoomPage />} />
          <Route path="/servers" element={<ServersPage />} />
          <Route path="/messages" element={<DMPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <Toaster />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
