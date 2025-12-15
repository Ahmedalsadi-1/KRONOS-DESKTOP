import React, { createContext, useContext, useState, useEffect, useReducer } from 'react';

const UpdateContext = createContext();

const updateReducer = (state, action) => {
  switch (action.type) {
    case 'SET_UPDATE_STATUS':
      return { ...state, status: action.payload };
    case 'SET_UPDATE_PROGRESS':
      return { ...state, progress: action.payload };
    case 'SET_UPDATE_INFO':
      return { ...state, info: action.payload };
    case 'START_UPDATE':
      return { ...state, isChecking: true };
    case 'CLEAR_UPDATE':
      return { ...state, isChecking: false, status: 'idle', progress: null };
    default:
      return state;
  }
};

const initialState = {
  status: 'idle',
  progress: null,
  info: null,
  isChecking: false,
  isDownloading: false
};

export function UpdateProvider({ children }) {
  const [state, dispatch] = useReducer(updateReducer, initialState);

  const checkForUpdates = async () => {
    dispatch({ type: 'START_UPDATE' });
    try {
      await window.kronosApp.checkUpdates();
    } catch (error) {
      console.error('Update check failed:', error);
      dispatch({ 
        type: 'SET_UPDATE_STATUS', 
        payload: { status: 'error', error: error.message } 
      });
    }
  };

  const installUpdate = async () => {
    try {
      // This will trigger the auto-updater
      await window.kronosApp.installUpdate();
    } catch (error) {
      console.error('Update installation failed:', error);
      dispatch({ 
        type: 'SET_UPDATE_STATUS', 
        payload: { status: 'error', error: error.message } 
      });
    }
  };

  const clearUpdate = () => {
    dispatch({ type: 'CLEAR_UPDATE' });
  };

  // Listen for update events from main process
  useEffect(() => {
    window.kronosEvents.onUpdateStatus((data) => {
      dispatch({ type: 'SET_UPDATE_STATUS', payload: data });
    });

    window.kronosEvents.onUpdateProgress((data) => {
      dispatch({ type: 'SET_UPDATE_PROGRESS', payload: data });
    });
  }, []);

  const value = {
    ...state,
    checkForUpdates,
    installUpdate,
    clearUpdate
  };

  return (
    <UpdateContext.Provider value={value}>
      {children}
    </UpdateContext.Provider>
  );
}

export function useUpdate() {
  const context = useContext(UpdateContext);
  if (!context) {
    throw new Error('useUpdate must be used within an UpdateProvider');
  }
  return context;
}

export { UpdateContext };