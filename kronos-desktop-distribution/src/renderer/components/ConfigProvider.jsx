import React, { createContext, useContext, useReducer } from 'react';

const ConfigContext = createContext();

const configReducer = (state, action) => {
  switch (action.type) {
    case 'SET_CONFIG':
      return { ...state, ...action.payload };
    case 'UPDATE_CONFIG':
      return { ...state, ...action.payload };
    case 'RESET_CONFIG':
      return action.payload;
    default:
      return state;
  }
};

const initialState = {
  version: '1.0.0',
  autoStart: false,
  startMinimized: false,
  checkUpdates: true,
  theme: 'dark',
  services: {
    ai: true,
    webAutomation: true,
    computerVision: true,
    androidControl: true
  },
  distribution: {
    platform: 'unknown',
    arch: 'unknown',
    installDate: new Date().toISOString()
  }
};

export function ConfigProvider({ children }) {
  const [config, dispatch] = useReducer(configReducer, initialState);

  const setConfig = (newConfig) => {
    dispatch({ type: 'UPDATE_CONFIG', payload: newConfig });
  };

  const resetConfig = () => {
    dispatch({ type: 'RESET_CONFIG', payload: initialState });
  };

  const updateConfig = (updates) => {
    dispatch({ type: 'UPDATE_CONFIG', payload: updates });
  };

  const saveConfig = async () => {
    try {
      const success = await window.kronosConfig.setConfig(config);
      if (success) {
        console.log('Configuration saved successfully');
      } else {
        console.error('Failed to save configuration');
      }
    } catch (error) {
      console.error('Error saving configuration:', error);
    }
  };

  const loadConfig = async () => {
    try {
      const loadedConfig = await window.kronosConfig.getConfig();
      if (loadedConfig) {
        dispatch({ type: 'SET_CONFIG', payload: loadedConfig });
      }
    } catch (error) {
      console.error('Error loading configuration:', error);
    }
  };

  // Initialize with saved config
  React.useEffect(() => {
    loadConfig();
  }, []);

  const value = {
    config,
    setConfig,
    resetConfig,
    updateConfig,
    saveConfig,
    loadConfig
  };

  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
}

export { ConfigContext };