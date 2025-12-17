import React from 'react';

export function KronosLogo() {
  return (
    <div className="flex items-center space-x-3">
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-accent"
      >
        {/* Kronos bunny helmet silhouette */}
        <path
          d="M12 2L8 6L10 8L12 6L14 8L16 6L12 2Z"
          fill="currentColor"
          opacity="0.9"
        />
        <path
          d="M8 8L10 10L14 10L16 8L14 6L10 6L8 8Z"
          fill="currentColor"
          opacity="0.7"
        />
        <path
          d="M6 10L8 12L10 14L14 14L16 12L18 10L16 8L14 10L10 10L8 8L6 10Z"
          fill="currentColor"
          opacity="0.5"
        />
        <path
          d="M4 12L6 14L8 16L16 16L18 14L20 12L18 10L16 12L8 12L6 10L4 12Z"
          fill="currentColor"
          opacity="0.3"
        />
      </svg>
      <span className="text-xl font-bold text-accent">Kronos</span>
    </div>
  );
}