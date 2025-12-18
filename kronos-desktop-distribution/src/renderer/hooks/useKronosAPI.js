import { useEffect, useState, useCallback } from 'react';

// Custom hook for KRONOS API communication
export function useKronosAPI() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Check if preload API is available
    const checkAPIReady = () => {
      if (window.kronosConfig && window.kronosApp && window.kronosServices && window.kronosDist && window.kronosEvents) {
        setIsReady(true);
        console.log('KRONOS API ready');
      } else {
        setTimeout(checkAPIReady, 100);
      }
    };

    checkAPIReady();
  }, []);

  const getConfig = useCallback(async () => {
    if (!isReady) throw new Error('KRONOS API not ready');
    return await window.kronosConfig.getConfig();
  }, [isReady]);

  const setConfig = useCallback(async (config) => {
    if (!isReady) throw new Error('KRONOS API not ready');
    return await window.kronosConfig.setConfig(config);
  }, [isReady]);

  const getAppInfo = useCallback(async () => {
    if (!isReady) throw new Error('KRONOS API not ready');
    return await window.kronosApp.getInfo();
  }, [isReady]);

  const getServicesStatus = useCallback(async () => {
    if (!isReady) throw new Error('KRONOS API not ready');
    return await window.kronosServices.getStatus();
  }, [isReady]);

  const restartServices = useCallback(async () => {
    if (!isReady) throw new Error('KRONOS API not ready');
    return await window.kronosServices.restart();
  }, [isReady]);

  return {
    isReady,
    getConfig,
    setConfig,
    getAppInfo,
    getServicesStatus,
    restartServices
  };
}
