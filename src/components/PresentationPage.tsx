import React from 'react';
import PresentationViewer from './PresentationViewer';

// Thin wrapper (could be extended for preloading logic or permissions)
export const PresentationPage: React.FC = () => {
  return <PresentationViewer />;
};

export default PresentationPage;