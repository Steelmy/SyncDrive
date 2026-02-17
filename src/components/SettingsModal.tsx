import { useState, useEffect } from 'react';
import { Folder, RefreshCw, Info, Edit3, Check, AlertCircle, LogOut, Archive, Power, PowerOff, Download } from 'lucide-react';
import { Instance } from '../types';
import Modal from './ui/Modal';
import ToggleSwitch from './ui/ToggleSwitch';
import AlertBanner from './ui/AlertBanner';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentInstance: Instance | null;
  onChangeDirectory: () => void;
  onLogout: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentInstance,
  onChangeDirectory,
  onLogout
}) => {
  const [isEditingPath, setIsEditingPath] = useState(false);
  const [editedPath, setEditedPath] = useState('');
  const [pathError, setPathError] = useState('');
  const [syncInterval, setSyncInterval] = useState(5);
  const [isUpdatingInterval, setIsUpdatingInterval] = useState(false);
  const [zipMode, setZipMode] = useState(false);
  const [isUpdatingZipMode, setIsUpdatingZipMode] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [isUpdatingAutoSync, setIsUpdatingAutoSync] = useState(false);
  
  // Download settings
  const [downloadPath, setDownloadPath] = useState('');
  const [downloadUnzip, setDownloadUnzip] = useState(true);
  const [downloadReplace, setDownloadReplace] = useState(false);
  const [isUpdatingDownloadSettings, setIsUpdatingDownloadSettings] = useState(false);

  useEffect(() => {
    if (currentInstance) {
      setEditedPath(currentInstance.rootDirectory || '');
      setSyncInterval(Math.floor(currentInstance.syncInterval / (60 * 1000)));
      setZipMode(currentInstance.zipMode || false);
      setAutoSyncEnabled(currentInstance.autoSyncEnabled !== false);
      setDownloadPath(currentInstance.downloadPath || '');
      setDownloadUnzip(currentInstance.downloadUnzip ?? true);
      setDownloadReplace(currentInstance.downloadReplace ?? false);
    }
  }, [currentInstance]);

  if (!currentInstance) return null;

  // ─── Handlers ──────────────────────────────────────────────────

  const handlePathEdit = () => {
    setIsEditingPath(true);
    setPathError('');
  };

  const handlePathSave = async () => {
    if (!editedPath.trim()) {
      setPathError('Path cannot be empty');
      return;
    }
    try {
      const result = await window.electronAPI.updateDirectoryPath(currentInstance.id, editedPath);
      if (result.success) {
        setIsEditingPath(false);
        setPathError('');
        window.location.reload();
      } else {
        setPathError(result.error || 'Failed to update path');
      }
    } catch {
      setPathError('Failed to update path');
    }
  };

  const handlePathCancel = () => {
    setIsEditingPath(false);
    setEditedPath(currentInstance.rootDirectory || '');
    setPathError('');
  };

  const handleSettingUpdate = async (
    updateFn: () => Promise<boolean>,
    setUpdating: (v: boolean) => void
  ) => {
    setUpdating(true);
    try {
      const success = await updateFn();
      if (success) {
        setTimeout(() => setUpdating(false), 1000);
      } else {
        setUpdating(false);
      }
    } catch (error) {
      console.error('Failed to update setting:', error);
      setUpdating(false);
    }
  };

  const handleSyncIntervalUpdate = () =>
    handleSettingUpdate(
      () => window.electronAPI.updateSyncInterval(currentInstance.id, syncInterval),
      setIsUpdatingInterval
    );

  const handleZipModeUpdate = (newZipMode: boolean) => {
    handleSettingUpdate(
      async () => {
        const success = await window.electronAPI.updateZipMode(currentInstance.id, newZipMode);
        if (success) setZipMode(newZipMode);
        return success;
      },
      setIsUpdatingZipMode
    );
  };

  const handleAutoSyncToggle = (enabled: boolean) => {
    handleSettingUpdate(
      async () => {
        const success = await window.electronAPI.updateAutoSync(currentInstance.id, enabled);
        if (success) setAutoSyncEnabled(enabled);
        return success;
      },
      setIsUpdatingAutoSync
    );
  };

  const handleSelectDownloadDirectory = async () => {
    try {
      const result = await window.electronAPI.selectDownloadDirectory(currentInstance.id);
      if (result) setDownloadPath(result);
    } catch (error) {
      console.error('Failed to select download directory:', error);
    }
  };

  const handleUpdateDownloadSettings = () =>
    handleSettingUpdate(
      () => window.electronAPI.updateDownloadSettings(currentInstance.id, {
        downloadPath,
        downloadUnzip,
        downloadReplace
      }),
      setIsUpdatingDownloadSettings
    );

  // ─── Render ────────────────────────────────────────────────────

  const footer = (
    <button
      onClick={onClose}
      className="w-full py-2 px-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
    >
      Close
    </button>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Settings - ${currentInstance.name}`}
      footer={footer}
    >
      {/* Google Account Section */}
      {currentInstance.isAuthenticated && currentInstance.userInfo && (
        <div>
          <h3 className="text-lg font-medium text-gray-800 mb-3">Google Account</h3>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {currentInstance.userInfo.picture && (
                  <img
                    src={currentInstance.userInfo.picture}
                    alt="Profile"
                    className="w-10 h-10 rounded-full"
                  />
                )}
                <div>
                  <p className="font-medium text-gray-800">{currentInstance.userInfo.name}</p>
                  <p className="text-sm text-gray-600">{currentInstance.userInfo.email}</p>
                </div>
              </div>
              <button
                onClick={onLogout}
                className="flex items-center px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
              >
                <LogOut className="h-4 w-4 mr-1" />
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Root Directory Section */}
      <div>
        <h3 className="text-lg font-medium text-gray-800 mb-3 flex items-center">
          <Folder className="h-5 w-5 mr-2 text-blue-600" />
          Root Directory
        </h3>
        
        {isEditingPath ? (
          <div className="space-y-3">
            <div>
              <input
                type="text"
                value={editedPath}
                onChange={(e) => setEditedPath(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                placeholder="Enter directory path"
              />
              {pathError && (
                <div className="mt-2 flex items-center text-red-600 text-sm">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {pathError}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handlePathSave}
                className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
              >
                <Check className="h-4 w-4 mr-1" />
                Save
              </button>
              <button
                onClick={handlePathCancel}
                className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div 
              className="bg-gray-50 p-3 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors group"
              onClick={handlePathEdit}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-mono text-gray-700 break-all flex-1">
                  {currentInstance.rootDirectory || 'No directory selected'}
                </p>
                <Edit3 className="h-4 w-4 text-gray-400 group-hover:text-gray-600 ml-2 flex-shrink-0" />
              </div>
            </div>
            <button
              onClick={onChangeDirectory}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Browse for Directory
            </button>
          </div>
        )}
      </div>

      {/* Sync Mode Section */}
      <div>
        <h3 className="text-lg font-medium text-gray-800 mb-3 flex items-center">
          <Archive className="h-5 w-5 mr-2 text-blue-600" />
          Sync Mode
        </h3>
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-medium text-gray-800">
                {zipMode ? 'ZIP Archive Mode' : 'Individual Files Mode'}
              </p>
              <p className="text-sm text-gray-600">
                {zipMode 
                  ? 'Compress entire folder into a ZIP file before uploading'
                  : 'Upload and sync individual files separately'
                }
              </p>
            </div>
            <ToggleSwitch
              enabled={zipMode}
              onChange={handleZipModeUpdate}
              disabled={isUpdatingZipMode}
            />
          </div>

          {zipMode && (
            <AlertBanner variant="info" title="ZIP Mode Benefits:">
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Faster upload (single file vs multiple files)</li>
                <li>Compressed size saves storage space</li>
                <li>Complete folder backup in one archive</li>
                <li>Automatic naming: FolderName_YYYY-MM-DD.zip</li>
              </ul>
            </AlertBanner>
          )}
        </div>
      </div>

      {/* Sync Settings */}
      <div>
        <h3 className="text-lg font-medium text-gray-800 mb-3 flex items-center">
          <RefreshCw className="h-5 w-5 mr-2 text-blue-600" />
          Sync Settings
        </h3>
        <div className="space-y-4">
          {/* Auto-sync Toggle */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-medium text-gray-800 flex items-center">
                  {autoSyncEnabled ? (
                    <Power className="h-4 w-4 mr-2 text-green-600" />
                  ) : (
                    <PowerOff className="h-4 w-4 mr-2 text-red-600" />
                  )}
                  Auto-sync {autoSyncEnabled ? 'Enabled' : 'Disabled'}
                </p>
                <p className="text-sm text-gray-600">
                  {autoSyncEnabled 
                    ? 'Files will be synchronized automatically at the set interval'
                    : 'Automatic synchronization is disabled. Use manual sync only.'
                  }
                </p>
              </div>
              <ToggleSwitch
                enabled={autoSyncEnabled}
                onChange={handleAutoSyncToggle}
                disabled={isUpdatingAutoSync}
                activeColor="bg-green-600"
                inactiveColor="bg-red-500"
              />
            </div>
            
            {!autoSyncEnabled && (
              <AlertBanner variant="warning" title="Auto-sync Disabled">
                <p>Your files will only sync when you manually click "Sync Now".</p>
              </AlertBanner>
            )}
          </div>

          {/* Sync Interval */}
          {autoSyncEnabled && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Auto-sync interval (minutes)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="1440"
                  value={syncInterval}
                  onChange={(e) => setSyncInterval(parseInt(e.target.value) || 1)}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <span className="text-sm text-gray-600">minutes</span>
                <button
                  onClick={handleSyncIntervalUpdate}
                  disabled={isUpdatingInterval || syncInterval === Math.floor(currentInstance.syncInterval / (60 * 1000))}
                  className={`px-3 py-2 rounded-lg text-white text-sm transition-colors ${
                    isUpdatingInterval
                      ? 'bg-green-500'
                      : syncInterval === Math.floor(currentInstance.syncInterval / (60 * 1000))
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {isUpdatingInterval ? '✓ Updated' : 'Update'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Current: {Math.floor(currentInstance.syncInterval / (60 * 1000))} minutes
              </p>
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <span className="text-gray-700">Last sync</span>
            <span className="text-sm text-gray-500">
              {currentInstance.lastSyncTime 
                ? new Date(currentInstance.lastSyncTime).toLocaleString()
                : 'Never'
              }
            </span>
          </div>
        </div>
      </div>

      {/* Download Settings */}
      <div>
        <h3 className="text-lg font-medium text-gray-800 mb-3 flex items-center">
          <Download className="h-5 w-5 mr-2 text-blue-600" />
          Download Settings
        </h3>
        <div className="space-y-4">
          {/* Download Directory */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Download Directory
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={downloadPath}
                onChange={(e) => setDownloadPath(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                placeholder="Select download directory..."
                readOnly
              />
              <button
                onClick={handleSelectDownloadDirectory}
                className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
              >
                Browse
              </button>
            </div>
          </div>

          {/* Download Options */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-800">Unzip downloaded files</p>
                <p className="text-sm text-gray-600">Extract files from ZIP after download</p>
              </div>
              <ToggleSwitch
                enabled={downloadUnzip}
                onChange={(v) => setDownloadUnzip(v)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-800">Replace existing files</p>
                <p className="text-sm text-gray-600">Overwrite files (creates backup)</p>
              </div>
              <ToggleSwitch
                enabled={downloadReplace}
                onChange={(v) => setDownloadReplace(v)}
              />
            </div>
          </div>

          <button
            onClick={handleUpdateDownloadSettings}
            disabled={isUpdatingDownloadSettings}
            className={`w-full py-2 px-4 rounded-lg text-white text-sm transition-colors ${
              isUpdatingDownloadSettings
                ? 'bg-green-500'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isUpdatingDownloadSettings ? '✓ Updated' : 'Update Download Settings'}
          </button>
        </div>
      </div>

      {/* About Section */}
      <div>
        <h3 className="text-lg font-medium text-gray-800 mb-3 flex items-center">
          <Info className="h-5 w-5 mr-2 text-blue-600" />
          About
        </h3>
        <div className="space-y-2 text-sm text-gray-600">
          <p><strong>Version:</strong> 1.0.0</p>
          <p><strong>Instance ID:</strong> {currentInstance.id}</p>
          <p><strong>Sync Mode:</strong> {zipMode ? 'ZIP Archive' : 'Individual Files'}</p>
          <p><strong>Auto-sync:</strong> {autoSyncEnabled ? 'Enabled' : 'Disabled'}</p>
          <p><strong>Description:</strong> Sync your files with Google Drive automatically</p>
        </div>
      </div>
    </Modal>
  );
};

export default SettingsModal;