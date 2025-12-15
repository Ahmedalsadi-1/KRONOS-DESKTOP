import React, { createContext, useContext, useReducer, useEffect } from 'react';

const NavigationContext = createContext();

const navigationReducer = (state, action) => {
  switch (action.type) {
    case 'NAVIGATE':
      return { ...state, currentView: action.payload };
    case 'SET_HISTORY':
      return { ...state, history: [...state.history, action.payload] };
    case 'GO_BACK':
      if (state.history.length > 0) {
        const newHistory = [...state.history];
        newHistory.pop();
        const previousView = newHistory[newHistory.length - 1];
        return { ...state, history: newHistory, currentView: previousView };
      }
      return state;
    default:
      return state;
  }
};

const initialState = {
  currentView: 'dashboard',
  history: []
};

export function NavigationProvider({ children }) {
  const [state, dispatch] = useReducer(navigationReducer, initialState);

  const navigate = (view) => {
    dispatch({ type: 'NAVIGATE', payload: view });
  };

  const goBack = () => {
    dispatch({ type: 'GO_BACK' });
  };

  const addToHistory = (view) => {
    dispatch({ type: 'SET_HISTORY', payload: view });
  };

  const value = {
    currentView: state.currentView,
    history: state.history,
    navigate,
    goBack,
    addToHistory
  };

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}

export { NavigationContext };