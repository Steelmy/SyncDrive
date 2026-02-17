import React, { useState } from 'react';
import { X, Download, FolderOpen, Archive, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { Instance, DownloadOptions } from '../types';

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

  if (!isOpen) return null;

  const handleSelectDirectory = async () => {
    try {
      const result = await window.electronAPI.selectDownloadDirectory(instance.id);
      if (result) {
        setDownloadPath(result);
      }
    } catch (error) {
      console.error('Failed to select directory:', error);
      setError('Failed to select directory');
    }
  };

  const handleDownload = async () => {
    if (!downloadPath.trim()) {
      setError('Please select a download directory');
      return;
    }

    setIsDownloading(true);
    setError('');

    try {
      const options: DownloadOptions = {
        downloadPath: downloadPath.trim(),
        unzipFiles,
        replaceFiles
      };

      await onDownload(options);
      onClose();
    } catch (error: any) {
      setError(error.message || 'Download failed');
    } finally {
      setIsDownloading(false);
    }
  };

  const isFirstTime = !instance.downloadPath;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-blue-600 p-6 text-white flex items-center justify-between">
          <div className="flex items-center">
            <Download className="h-6 w-6 mr-2" />
            <h2 className="text-xl font-semibold">
              {isFirstTime ? 'Configure Download' : 'Download from Drive'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {isFirstTime && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-start">
                <CheckCircle className="h-5 w-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">First Time Setup</p>
                  <p>Configure your download preferences. These settings will be saved for future downloads.</p>
                </div>
              </div>
            </div>
          )}

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
                placeholder="Select download directory..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                readOnly
              />
              <button
                onClick={handleSelectDirectory}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center"
              >
                <FolderOpen className="h-4 w-4 mr-1" />
                Browse
              </button>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-800">Download Options</h3>
            
            {/* Unzip Files Option */}
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
                  Unzip downloaded files
                </label>
                <p className="text-gray-500">
                  Extract files from ZIP archive after download. If unchecked, only the ZIP file will be saved.
                </p>
              </div>
            </div>

            {/* Replace Files Option */}
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
                  Replace existing files
                </label>
                <p className="text-gray-500">
                  Overwrite existing files in the destination. A backup will be created automatically.
                </p>
              </div>
            </div>

            {replaceFiles && (
              <div className="ml-7 p-3 bg-amber-50 rounded-lg">
                <div className="flex items-start">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mr-2 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-amber-800">
                    <p className="font-medium mb-1">Backup Protection</p>
                    <p>Before replacing files, a backup ZIP will be created and stored in your Drive's backup-local folder. Only the 20 most recent backups are kept.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Version Check Warning */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-start">
              <RefreshCw className="h-4 w-4 text-gray-600 mr-2 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-gray-700">
                <p className="font-medium mb-1">Version Check</p>
                <p>The download will be cancelled if your local files are newer than the Drive version to prevent data loss.</p>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 p-4 rounded-lg">
              <div className="flex items-start">
                <AlertTriangle className="h-4 w-4 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-red-800">
                  <p className="font-medium mb-1">Error</p>
                  <p>{error}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex gap-3">
          <button
            onClick={onClose}
            disabled={isDownloading}
            className="flex-1 py-2 px-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={isDownloading || !downloadPath.trim()}
            className={`flex-1 py-2 px-4 rounded-lg text-white font-medium transition-colors flex items-center justify-center ${
              isDownloading || !downloadPath.trim()
                ? 'bg-blue-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isDownloading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Downloading...
              </>
            ) : (
              <>
                <Archive className="h-4 w-4 mr-2" />
                Download
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DownloadModal;