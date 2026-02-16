
import React from 'react';

// Added strokeWidth to props definition to fix the "Property 'strokeWidth' does not exist" error in App.tsx.
export const Icon = ({ 
  name, 
  size = 20, 
  className = "", 
  strokeWidth 
}: { 
  name: string; 
  size?: number; 
  className?: string; 
  strokeWidth?: number; 
}) => {
  return (
    <i 
      data-lucide={name} 
      className={className} 
      style={{ width: size, height: size }}
      // Standard data attribute used by Lucide's createIcons to set the stroke width.
      data-lucide-stroke-width={strokeWidth}
    ></i>
  );
};
