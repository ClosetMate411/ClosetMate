import React, { memo } from 'react';

const WardrobeIcon = ({ size = 24, color = "currentColor", ...props }) => {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke={color} 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className="lucide lucide-wardrobe-icon lucide-wardrobe"
      {...props}
    >
      <rect width="18" height="20" x="3" y="2" rx="2"/>
      <path d="M8 10h.01"/>
      <path d="M12 2v15"/>
      <path d="M16 10h.01"/>
      <path d="M3 17h18"/>
    </svg>
  );
};

export default memo(WardrobeIcon);

