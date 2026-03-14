import { useState, useEffect } from 'react';
import { Folder, RefreshCw, Info, Edit3, Check, AlertCircle, LogOut, Archive, Power, PowerOff, Download, Globe } from 'lucide-react';
import { Instance } from '../types';
import Modal from './ui/Modal';
import ToggleSwitch from './ui/ToggleSwitch';
import AlertBanner from './ui/AlertBanner';
import { useTranslation } from '../i18n/LanguageContext';
import { Language } from '../i18n/translations';

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

  const { t, language, setLanguage } = useTranslation();

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
      setPathError(t('settings.pathCannotBeEmpty'));
      return;
    }
    try {
      const result = await window.electronAPI.updateDirectoryPath(currentInstance.id, editedPath);
      if (result.success) {
        setIsEditingPath(false);
        setPathError('');
        window.location.reload();
      } else {
        setPathError(result.error || t('settings.failedToUpdatePath'));
      }
    } catch {
      setPathError(t('settings.failedToUpdatePath'));
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

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
  };

  // ─── Render ────────────────────────────────────────────────────

  const footer = (
    <button
      onClick={onClose}
      className="w-full py-2 px-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
    >
      {t('settings.close')}
    </button>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${t('settings.title')} - ${currentInstance.name}`}
      footer={footer}
    >
      {/* Language Section */}
      <div>
        <h3 className="text-lg font-medium text-gray-800 mb-3 flex items-center">
          <Globe className="h-5 w-5 mr-2 text-blue-600" />
          {t('settings.language')}
        </h3>
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex gap-3">
            <button
              onClick={() => handleLanguageChange('fr')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                language === 'fr'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
              }`}
            >
              🇫🇷 {t('settings.languageFr')}
            </button>
            <button
              onClick={() => handleLanguageChange('en')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                language === 'en'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
              }`}
            >
              🇬🇧 {t('settings.languageEn')}
            </button>
          </div>
        </div>
      </div>

      {/* Google Account Section */}
      {currentInstance.isAuthenticated && currentInstance.userInfo && (
        <div>
          <h3 className="text-lg font-medium text-gray-800 mb-3">{t('settings.googleAccount')}</h3>
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
                {t('settings.logout')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Root Directory Section */}
      <div>
        <h3 className="text-lg font-medium text-gray-800 mb-3 flex items-center">
          <Folder className="h-5 w-5 mr-2 text-blue-600" />
          {t('settings.rootDirectory')}
        </h3>
        
        {isEditingPath ? (
          <div className="space-y-3">
            <div>
              <input
                type="text"
                value={editedPath}
                onChange={(e) => setEditedPath(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                placeholder={t('settings.enterDirectoryPath')}
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
                {t('settings.save')}
              </button>
              <button
                onClick={handlePathCancel}
                className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
              >
                {t('settings.cancel')}
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
                  {currentInstance.rootDirectory || t('settings.noDirectorySelected')}
                </p>
                <Edit3 className="h-4 w-4 text-gray-400 group-hover:text-gray-600 ml-2 flex-shrink-0" />
              </div>
            </div>
            <button
              onClick={onChangeDirectory}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              {t('settings.browseForDirectory')}
            </button>
          </div>
        )}
      </div>

      {/* Sync Mode Section */}
      <div>
        <h3 className="text-lg font-medium text-gray-800 mb-3 flex items-center">
          <Archive className="h-5 w-5 mr-2 text-blue-600" />
          {t('settings.syncMode')}
        </h3>
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-medium text-gray-800">
                {zipMode ? t('settings.zipArchiveMode') : t('settings.individualFilesMode')}
              </p>
              <p className="text-sm text-gray-600">
                {zipMode 
                  ? t('settings.zipModeDesc')
                  : t('settings.individualModeDesc')
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
            <AlertBanner variant="info" title={t('settings.zipBenefitsTitle')}>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>{t('settings.zipBenefit1')}</li>
                <li>{t('settings.zipBenefit2')}</li>
                <li>{t('settings.zipBenefit3')}</li>
                <li>{t('settings.zipBenefit4')}</li>
              </ul>
            </AlertBanner>
          )}
        </div>
      </div>

      {/* Sync Settings */}
      <div>
        <h3 className="text-lg font-medium text-gray-800 mb-3 flex items-center">
          <RefreshCw className="h-5 w-5 mr-2 text-blue-600" />
          {t('settings.syncSettings')}
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
                  {autoSyncEnabled ? t('settings.autoSyncEnabled') : t('settings.autoSyncDisabled')}
                </p>
                <p className="text-sm text-gray-600">
                  {autoSyncEnabled 
                    ? t('settings.autoSyncEnabledDesc')
                    : t('settings.autoSyncDisabledDesc')
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
              <AlertBanner variant="warning" title={t('settings.autoSyncDisabledWarning')}>
                <p>{t('settings.autoSyncDisabledWarningDesc')}</p>
              </AlertBanner>
            )}
          </div>

          {/* Sync Interval */}
          {autoSyncEnabled && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('settings.autoSyncInterval')}
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
                <span className="text-sm text-gray-600">{t('settings.minutes')}</span>
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
                  {isUpdatingInterval ? t('settings.updated') : t('settings.update')}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {t('settings.current')} {Math.floor(currentInstance.syncInterval / (60 * 1000))} {t('settings.minutes')}
              </p>
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <span className="text-gray-700">{t('settings.lastSync')}</span>
            <span className="text-sm text-gray-500">
              {currentInstance.lastSyncTime 
                ? new Date(currentInstance.lastSyncTime).toLocaleString()
                : t('settings.never')
              }
            </span>
          </div>
        </div>
      </div>

      {/* Download Settings */}
      <div>
        <h3 className="text-lg font-medium text-gray-800 mb-3 flex items-center">
          <Download className="h-5 w-5 mr-2 text-blue-600" />
          {t('settings.downloadSettings')}
        </h3>
        <div className="space-y-4">
          {/* Download Directory */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('settings.downloadDirectory')}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={downloadPath}
                onChange={(e) => setDownloadPath(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                placeholder={t('settings.selectDownloadDirectory')}
                readOnly
              />
              <button
                onClick={handleSelectDownloadDirectory}
                className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
              >
                {t('settings.browse')}
              </button>
            </div>
          </div>

          {/* Download Options */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-800">{t('settings.unzipDownloadedFiles')}</p>
                <p className="text-sm text-gray-600">{t('settings.unzipDesc')}</p>
              </div>
              <ToggleSwitch
                enabled={downloadUnzip}
                onChange={(v) => setDownloadUnzip(v)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-800">{t('settings.replaceExistingFiles')}</p>
                <p className="text-sm text-gray-600">{t('settings.replaceDesc')}</p>
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
            {isUpdatingDownloadSettings ? t('settings.updated') : t('settings.updateDownloadSettings')}
          </button>
        </div>
      </div>

      {/* About Section */}
      <div>
        <h3 className="text-lg font-medium text-gray-800 mb-3 flex items-center">
          <Info className="h-5 w-5 mr-2 text-blue-600" />
          {t('settings.about')}
        </h3>
        <div className="space-y-2 text-sm text-gray-600">
          <p><strong>{t('settings.version')}</strong> 1.0.0</p>
          <p><strong>{t('settings.instanceId')}</strong> {currentInstance.id}</p>
          <p><strong>{t('settings.syncModeLabel')}</strong> {zipMode ? t('settings.zipArchive') : t('settings.individualFiles')}</p>
          <p><strong>{t('settings.autoSync')}</strong> {autoSyncEnabled ? t('settings.enabled') : t('settings.disabled')}</p>
          <p><strong>{t('settings.description')}</strong> {t('settings.descriptionText')}</p>
        </div>
      </div>
    </Modal>
  );
};

export default SettingsModal;