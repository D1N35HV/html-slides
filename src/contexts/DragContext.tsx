import React, { createContext, useContext, useState, ReactNode } from 'react';

interface DragContextType {
  isDragging: boolean;
  hasMoved: boolean;
  setDragState: (isDragging: boolean, hasMoved: boolean) => void;
}

const DragContext = createContext<DragContextType | undefined>(undefined);

export function DragProvider({ children }: { children: ReactNode }) {
  const [isDragging, setIsDragging] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);

  const setDragState = (newIsDragging: boolean, newHasMoved: boolean) => {
    setIsDragging(newIsDragging);
    setHasMoved(newHasMoved);
  };

  return (
    <DragContext.Provider value={{ isDragging, hasMoved, setDragState }}>
      {children}
    </DragContext.Provider>
  );
}

export function useDrag() {
  const context = useContext(DragContext);
  if (context === undefined) {
    throw new Error('useDrag must be used within a DragProvider');
  }
  return context;
}
