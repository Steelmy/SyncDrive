import React, { useState } from 'react';
import { RefreshCw, Settings, FileText, Clock, Plus, Download } from 'lucide-react';
import { Instance, SyncRecord } from '../types';
import SyncHistoryList from './SyncHistoryList';
import SettingsModal from './SettingsModal';
import InstanceManager from './InstanceManager';
import GoogleAuthSetup from './GoogleAuthSetup';
import DownloadModal from './DownloadModal';

interface DashboardProps {
  instances: Instance[];
  currentInstance: Instance | null;
  onSwitchInstance: (instanceId: string) => void;
  onCreateInstance: (name: string) => void;
  onDeleteInstance: (instanceId: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  instances,
  currentInstance,
  onSwitchInstance,
  onCreateInstance,
  onDeleteInstance
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showGoogleAuth, setShowGoogleAuth] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{
    success?: boolean;
    message?: string;
  }>({});
  
  const handleSyncNow = async () => {
    if (isSyncing || !currentInstance) return;
    
    setIsSyncing(true);
    setSyncStatus({
      message: 'Syncing in progress...'
    });
    
    try {
      const result = await window.electronAPI.syncNow(currentInstance.id);
      setSyncStatus({
        success: result.success,
        message: result.message
      });
    } catch (error) {
      setSyncStatus({
        success: false,
        message: 'Failed to sync. Please try again.'
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDownload = async (options: any) => {
    if (!currentInstance) return;
    
    try {
      const result = await window.electronAPI.downloadFromDrive(currentInstance.id, options);
      
      if (result.success) {
        setSyncStatus({
          success: true,
          message: result.message
        });
        // Reload to update the UI with new settings
        window.location.reload();
      } else {
        if (result.isNewerLocal) {
          setSyncStatus({
            success: false,
            message: result.message
          });
        } else {
          throw new Error(result.message);
        }
      }
    } catch (error: any) {
      throw new Error(error.message || 'Download failed');
    }
  };

  const handleChangeDirectory = async () => {
    if (!currentInstance) return;
    
    try {
      const result = await window.electronAPI.selectDirectory(currentInstance.id);
      if (result) {
        // Reload the page to reflect the new directory
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to change directory:', error);
    }
  };

  const handleLogout = async () => {
    if (!currentInstance) return;
    
    try {
      await window.electronAPI.logoutGoogle(currentInstance.id);
      window.location.reload();
    } catch (error) {
      console.error('Failed to logout:', error);
    }
  };

  const handleAuthSuccess = () => {
    setShowGoogleAuth(false);
    window.location.reload();
  };
  
  // Format last sync time in a human-readable way
  const formattedLastSyncTime = currentInstance?.lastSyncTime 
    ? new Date(currentInstance.lastSyncTime).toLocaleString() 
    : 'Never';
    
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <RefreshCw className="h-6 w-6 text-blue-600 mr-2" />
            <h1 className="text-xl font-semibold text-gray-800">Drive Sync</h1>
            {currentInstance && (
              <span className="ml-3 px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full">
                {currentInstance.name}
              </span>
            )}
          </div>
          <button 
            onClick={() => setIsSettingsOpen(true)}
            disabled={!currentInstance}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <Settings className="h-5 w-5 text-gray-600" />
          </button>
        </div>
      </header>
      
      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Instance Manager */}
        <InstanceManager
          instances={instances}
          currentInstanceId={currentInstance?.id || null}
          onSwitchInstance={onSwitchInstance}
          onCreateInstance={onCreateInstance}
          onDeleteInstance={onDeleteInstance}
        />

        {currentInstance ? (
          <>
            {/* Directory info */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <h2 className="text-lg font-medium text-gray-800 mb-2">Root Directory</h2>
              {currentInstance.rootDirectory ? (
                <div className="bg-gray-50 p-3 rounded-lg break-all text-sm font-mono text-gray-700">
                  {currentInstance.rootDirectory}
                </div>
              ) : (
                <div className="bg-yellow-50 p-3 rounded-lg text-yellow-700">
                  No directory selected. Please select a directory to sync.
                </div>
              )}
              
              <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center text-sm text-gray-600">
                  <Clock className="h-4 w-4 mr-1" />
                  <span>Last sync: {formattedLastSyncTime}</span>
                </div>
                
                <div className="flex gap-2">
                  {currentInstance.isAuthenticated && currentInstance.rootDirectory && (
                    <>
                      <button
                        onClick={handleSyncNow}
                        disabled={isSyncing}
                        className={`
                          flex items-center justify-center px-4 py-2 rounded-lg text-white font-medium
                          transition-all duration-200 
                          ${isSyncing 
                            ? 'bg-blue-400 cursor-not-allowed' 
                            : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'}
                        `}
                      >
                        {isSyncing ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                            Syncing...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Sync Now
                          </>
                        )}
                      </button>
                      
                      <button
                        onClick={() => setShowDownloadModal(true)}
                        className="flex items-center justify-center px-4 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition-colors"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </button>
                    </>
                  )}
                </div>
              </div>
              
              {/* Sync status message */}
              {syncStatus.message && (
                <div className={`mt-4 p-3 rounded-lg ${
                  syncStatus.success === undefined
                    ? 'bg-blue-50 text-blue-700'
                    : syncStatus.success
                      ? 'bg-green-50 text-green-700'
                      : 'bg-red-50 text-red-700'
                }`}>
                  {syncStatus.message}
                </div>
              )}
            </div>
            
            {/* Authentication Status */}
            {!currentInstance.isAuthenticated && (
              <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <h2 className="text-lg font-medium text-gray-800 mb-2">Google Drive Authentication</h2>
                <p className="text-gray-600 mb-4">
                  You need to authenticate with Google Drive to start syncing files.
                </p>
                <button
                  onClick={() => setShowGoogleAuth(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Authenticate with Google Drive
                </button>
              </div>
            )}
            
            {/* Sync History */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-medium text-gray-800 mb-4">Sync History</h2>
              
              {currentInstance.syncHistory && currentInstance.syncHistory.length > 0 ? (
                <SyncHistoryList history={currentInstance.syncHistory} />
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                  <p>No sync history available yet</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <Plus className="h-16 w-16 mx-auto text-gray-300 mb-4" />
            <h2 className="text-xl font-medium text-gray-800 mb-2">No Instance Selected</h2>
            <p className="text-gray-600 mb-4">Create or select an instance to get started.</p>
          </div>
        )}
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentInstance={currentInstance}
        onChangeDirectory={handleChangeDirectory}
        onLogout={handleLogout}
      />

      {/* Google Auth Modal */}
      {showGoogleAuth && currentInstance && (
        <GoogleAuthSetup
          instanceId={currentInstance.id}
          onAuthSuccess={handleAuthSuccess}
          onCancel={() => setShowGoogleAuth(false)}
        />
      )}

      {/* Download Modal */}
      {showDownloadModal && currentInstance && (
        <DownloadModal
          isOpen={showDownloadModal}
          onClose={() => setShowDownloadModal(false)}
          instance={currentInstance}
          onDownload={handleDownload}
        />
      )}
    </div>
  );
};

export default Dashboard;