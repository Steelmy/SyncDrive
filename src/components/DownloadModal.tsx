import { useState, useEffect } from 'react';
import { FolderOpen, Archive } from 'lucide-react';
import { Instance, DownloadOptions } from '../types';
import Modal from './ui/Modal';
import AlertBanner from './ui/AlertBanner';
import { useTranslation } from '../i18n/LanguageContext';

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  instance: Instance;
  onDownload: (options: DownloadOptions) => Promise<void>;
}

const DownloadModal: React.FC<DownloadModalProps> = ({
  isOpen,
  onClose,
  instance,
  onDownload
}) => {
  const [downloadPath, setDownloadPath] = useState(instance.downloadPath || '');
  const [unzipFiles, setUnzipFiles] = useState(instance.downloadUnzip ?? true);
  const [replaceFiles, setReplaceFiles] = useState(instance.downloadReplace ?? false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState('');
  const { t } = useTranslation();

  // Re-sync local state when instance data changes (e.g. after updating settings)
  useEffect(() => {
    setDownloadPath(instance.downloadPath || '');
    setUnzipFiles(instance.downloadUnzip ?? true);
    setReplaceFiles(instance.downloadReplace ?? false);
  }, [instance.downloadPath, instance.downloadUnzip, instance.downloadReplace]);

  const handleSelectDirectory = async () => {
    try {
      const result = await window.electronAPI.selectDownloadDirectory(instance.id);
      if (result) setDownloadPath(result);
    } catch {
      setError(t('download.failedToSelectDirectory'));
    }
  };

  const handleDownload = async () => {
    if (!downloadPath.trim()) {
      setError(t('download.selectDirectoryError'));
      return;
    }

    setIsDownloading(true);
    setError('');

    try {
      await onDownload({ downloadPath: downloadPath.trim(), unzipFiles, replaceFiles });
      onClose();
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : t('download.downloadFailed'));
    } finally {
      setIsDownloading(false);
    }
  };

  const isFirstTime = !instance.downloadPath;

  const footer = (
    <div className="flex gap-3">
      <button
        onClick={onClose}
        disabled={isDownloading}
        className="flex-1 py-2 px-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
      >
        {t('download.cancel')}
      </button>
      <button
        onClick={handleDownload}
        disabled={isDownloading || !downloadPath.trim()}
        className={`flex-1 py-2 px-4 rounded-lg text-white font-medium transition-colors flex items-center justify-center ${
          isDownloading || !downloadPath.trim() ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {isDownloading ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
            {t('download.downloading')}
          </>
        ) : (
          <>
            <Archive className="h-4 w-4 mr-2" />
            {t('download.downloadBtn')}
          </>
        )}
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isFirstTime ? t('download.configureDownload') : t('download.downloadFromDrive')}
      footer={footer}
    >
      {isFirstTime && (
        <AlertBanner variant="info" title={t('download.firstTimeSetup')}>
          <p>{t('download.firstTimeSetupDesc')}</p>
        </AlertBanner>
      )}

      {/* Download Directory */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('download.downloadDirectory')}</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={downloadPath}
            onChange={(e) => setDownloadPath(e.target.value)}
            placeholder={t('download.selectDirectory')}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
            readOnly
          />
          <button
            onClick={handleSelectDirectory}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center"
          >
            <FolderOpen className="h-4 w-4 mr-1" />
            {t('download.browse')}
          </button>
        </div>
      </div>

      {/* Options */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-800">{t('download.downloadOptions')}</h3>
        
        <div className="flex items-start space-x-3">
          <div className="flex items-center h-5">
            <input
              id="unzip-files"
              type="checkbox"
              checked={unzipFiles}
              onChange={(e) => setUnzipFiles(e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
            />
          </div>
          <div className="text-sm">
            <label htmlFor="unzip-files" className="font-medium text-gray-700 cursor-pointer">
              {t('download.unzipFiles')}
            </label>
            <p className="text-gray-500">
              {t('download.unzipDesc')}
            </p>
          </div>
        </div>

        <div className="flex items-start space-x-3">
          <div className="flex items-center h-5">
            <input
              id="replace-files"
              type="checkbox"
              checked={replaceFiles}
              onChange={(e) => setReplaceFiles(e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
            />
          </div>
          <div className="text-sm">
            <label htmlFor="replace-files" className="font-medium text-gray-700 cursor-pointer">
              {t('download.replaceFiles')}
            </label>
            <p className="text-gray-500">
              {t('download.replaceDesc')}
            </p>
          </div>
        </div>

        {replaceFiles && (
          <div className="ml-7">
            <AlertBanner variant="warning" title={t('download.backupProtection')}>
              <p>{t('download.backupProtectionDesc')}</p>
            </AlertBanner>
          </div>
        )}
      </div>

      {/* Version Check Warning */}
      <AlertBanner variant="info" title={t('download.versionCheck')}>
        <p>{t('download.versionCheckDesc')}</p>
      </AlertBanner>

      {error && (
        <AlertBanner variant="error" title={t('download.error')}>
          <p>{error}</p>
        </AlertBanner>
      )}
    </Modal>
  );
};

export default DownloadModal;