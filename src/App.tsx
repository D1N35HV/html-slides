import React from 'react';
import { Toolbar } from './components/Toolbar';
import { Preview } from './components/Preview';
import { ElementsSidebar } from './components/ElementsSidebar';
import { Toaster } from 'react-hot-toast';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import ProtectedRoute from './components/ProtectedRoute';
import PublicOnlyRoute from './components/PublicOnlyRoute';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import EditorPage from './components/EditorPage';
import PresentationPage from './components/PresentationPage';
import ThumbnailRenderer from './components/ThumbnailRenderer';
import LandingPage from './components/landing/LandingPage';
import SettingsPage from './components/SettingsPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/editor/:id" element={<EditorPage />} />
          <Route path="/present/:id" element={<PresentationPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/:section" element={<SettingsPage />} />
        </Route>

        {/* Thumbnail route for server-side rendering (Puppeteer) — intentionally ungated */}
        <Route path="/thumbnail/:presentationId/:slideIndex" element={<ThumbnailRenderer />} />

        {/* Public-only routes: authenticated users get bounced to Dashboard */}
        <Route element={<PublicOnlyRoute />}>
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          {/* Fallback: unauthenticated users land on marketing, authenticated get redirected */}
          <Route path="*" element={<LandingPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
