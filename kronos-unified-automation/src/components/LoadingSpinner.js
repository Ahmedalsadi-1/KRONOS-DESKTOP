import React from 'react';

const LoadingSpinner = ({ message = 'Loading...' }) => {
  return (
    <div className="flex-center" style={{ 
      minHeight: '100vh', 
      flexDirection: 'column',
      backgroundColor: '#f8f9fa'
    }}>
      <div className="spinner" style={{ width: '40px', height: '40px' }}></div>
      <p style={{ 
        marginTop: '16px', 
        color: '#666', 
        fontSize: '16px' 
      }}>
        {message}
      </p>
    </div>
  );
};

export default LoadingSpinner;
