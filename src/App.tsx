import React, { useEffect, useState } from 'react';
import SetupWizard from './components/SetupWizard';
import Dashboard from './components/Dashboard';
import { AppConfig, Instance } from './types';

function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // Load config when component mounts
    loadConfig();
    
    // Setup listeners for events from main process
    window.electronAPI.onConfigLoaded((data) => {
      setConfig(data);
      setIsLoading(false);
    });
    
    window.electronAPI.onSyncCompleted((data) => {
      // Reload config to get updated sync history
      loadConfig();
    });
  }, []);
  
  const loadConfig = async () => {
    try {
      const configData = await window.electronAPI.getConfig();
      setConfig(configData);
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to load config:', error);
      setIsLoading(false);
    }
  };
  
  const handleDirectorySelected = async () => {
    await loadConfig();
  };

  const handleSwitchInstance = async (instanceId: string) => {
    try {
      await window.electronAPI.switchInstance(instanceId);
      await loadConfig();
    } catch (error) {
      console.error('Failed to switch instance:', error);
    }
  };

  const handleCreateInstance = async (name: string) => {
    try {
      await window.electronAPI.createInstance(name);
      await loadConfig();
    } catch (error) {
      console.error('Failed to create instance:', error);
    }
  };

  const handleDeleteInstance = async (instanceId: string) => {
    try {
      await window.electronAPI.deleteInstance(instanceId);
      await loadConfig();
    } catch (error) {
      console.error('Failed to delete instance:', error);
    }
  };
  
  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-blue-600 text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xl font-medium">Loading application...</p>
        </div>
      </div>
    );
  }

  // Show setup wizard if no instances exist
  if (!config?.hasCompletedSetup) {
    return <SetupWizard onDirectorySelected={handleDirectorySelected} />;
  }

  // Find current instance
  const currentInstance = config.instances.find(
    instance => instance.id === config.currentInstanceId
  ) || config.instances[0] || null;

  // Show the main dashboard
  return (
    <Dashboard 
      instances={config.instances}
      currentInstance={currentInstance}
      onSwitchInstance={handleSwitchInstance}
      onCreateInstance={handleCreateInstance}
      onDeleteInstance={handleDeleteInstance}
    />
  );
}

export default App;