import React from 'react';
import { Toolbar } from './components/Toolbar';
import { Preview } from './components/Preview';
import { ElementsSidebar } from './components/ElementsSidebar';
import { Toaster } from 'react-hot-toast';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import CreatePresentationPage from './components/CreatePresentationPage';
import EditorPage from './components/EditorPage';
import PresentationPage from './components/PresentationPage';
import LandingPage from './components/landing/LandingPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/landing" element={<LandingPage />} />
        <Route element={<ProtectedRoute /> }>
          <Route path="/" element={<Dashboard />} />
          <Route path="/create" element={<CreatePresentationPage />} />
          <Route path="/editor/:id" element={<EditorPage />} />
          <Route path="/present/:id" element={<PresentationPage />} />
        </Route>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        {/* Fallback route to avoid blank screen */}
        <Route path="*" element={<LandingPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
