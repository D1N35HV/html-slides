import React from 'react';
import ReactDOM from 'react-dom/client';
import { ScormViewer } from './components/ScormViewer';
import './index.css';
import { scormAPI } from './SCORM_API_Wrapper';

// Initialize SCORM when app starts
scormAPI.init();

// Ensure SCORM session closes cleanly if possible
window.addEventListener('beforeunload', () => {
  scormAPI.commit();
  scormAPI.finish();
});

// The backend injects the slides JSON onto window
const slidesData = (window as any).__SLIDES_DATA__ || [];

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ScormViewer slides={slidesData} />
  </React.StrictMode>
);
