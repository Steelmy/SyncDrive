import React, { useState } from 'react';
import { ExternalLink, Key, AlertCircle, CheckCircle, Copy, Info } from 'lucide-react';

interface GoogleAuthSetupProps {
  instanceId: string;
  onAuthSuccess: () => void;
  onCancel: () => void;
}

const GoogleAuthSetup: React.FC<GoogleAuthSetupProps> = ({
  instanceId,
  onAuthSuccess,
  onCancel
}) => {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [showManualAuth, setShowManualAuth] = useState(false);
  const [authCode, setAuthCode] = useState('');
  const [authUrl, setAuthUrl] = useState('');
  const [error, setError] = useState('');
  const [isManualAuthenticating, setIsManualAuthenticating] = useState(false);

  const handleAutoAuth = async () => {
    setIsAuthenticating(true);
    setError('');
    
    try {
      const result = await window.electronAPI.authenticateGoogle(instanceId);
      if (result.success) {
        onAuthSuccess();
      } else {
        setError(result.error || 'Authentication failed');
        // Show manual auth option if auto auth fails
        setShowManualAuth(true);
        await getAuthUrl();
      }
    } catch (error) {
      setError('Authentication failed. Please try manual authentication.');
      setShowManualAuth(true);
      await getAuthUrl();
    } finally {
      setIsAuthenticating(false);
    }
  };

  const getAuthUrl = async () => {
    try {
      const result = await window.electronAPI.getGoogleAuthUrl(instanceId);
      if (result.success && result.authUrl) {
        setAuthUrl(result.authUrl);
      } else {
        setError(result.error || 'Failed to get authentication URL');
      }
    } catch (error) {
      console.error('Failed to get auth URL:', error);
      setError('Failed to get authentication URL');
    }
  };

  const handleManualAuth = async () => {
    if (!authCode.trim()) {
      setError('Please enter the authorization code');
      return;
    }

    setIsManualAuthenticating(true);
    setError('');

    try {
      const result = await window.electronAPI.authenticateWithCode(instanceId, authCode.trim());
      if (result.success) {
        onAuthSuccess();
      } else {
        setError(result.error || 'Invalid authorization code');
      }
    } catch (error) {
      setError('Authentication failed. Please check the code and try again.');
    } finally {
      setIsManualAuthenticating(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const openAuthUrl = () => {
    if (authUrl) {
      window.open(authUrl, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="bg-blue-600 p-6 text-white">
          <h2 className="text-xl font-semibold">Connect to Google Drive</h2>
          <p className="mt-2 opacity-90">Authenticate to start syncing your files</p>
        </div>

        <div className="p-6 space-y-6">
          {/* Configuration Warning */}
          <div className="flex items-start p-3 bg-amber-50 text-amber-800 rounded-lg">
            <Info className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium mb-1">Setup Required</p>
              <p>Make sure to configure your Google Drive API credentials in <code className="bg-amber-100 px-1 rounded">electron/main.cjs</code> before authenticating.</p>
            </div>
          </div>

          {!showManualAuth ? (
            // Automatic authentication
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Key className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">
                  Automatic Authentication
                </h3>
                <p className="text-gray-600">
                  Click the button below to open Google's authentication page in your browser.
                </p>
              </div>

              {error && (
                <div className="flex items-start p-3 bg-red-50 text-red-700 rounded-lg">
                  <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              <button
                onClick={handleAutoAuth}
                disabled={isAuthenticating}
                className={`w-full py-3 px-4 rounded-lg text-white font-medium transition-all duration-200 ${
                  isAuthenticating
                    ? 'bg-blue-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isAuthenticating ? (
                  <div className="flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Authenticating...
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <ExternalLink className="h-5 w-5 mr-2" />
                    Authenticate with Google
                  </div>
                )}
              </button>

              <div className="text-center">
                <button
                  onClick={() => {
                    setShowManualAuth(true);
                    getAuthUrl();
                  }}
                  className="text-sm text-blue-600 hover:text-blue-700 underline"
                >
                  Having trouble? Try manual authentication
                </button>
              </div>
            </div>
          ) : (
            // Manual authentication
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Key className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">
                  Manual Authentication
                </h3>
                <p className="text-gray-600 text-sm">
                  Follow these steps to authenticate manually:
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Step 1: Open the authentication URL
                  </p>
                  {authUrl ? (
                    <div className="flex gap-2">
                      <button
                        onClick={openAuthUrl}
                        className="flex-1 py-2 px-3 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
                      >
                        <ExternalLink className="h-4 w-4 inline mr-1" />
                        Open Auth Page
                      </button>
                      <button
                        onClick={() => copyToClipboard(authUrl)}
                        className="p-2 bg-gray-200 text-gray-600 rounded hover:bg-gray-300 transition-colors"
                        title="Copy URL"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="text-sm text-red-600">
                      Failed to generate authentication URL. Please check your API credentials.
                    </div>
                  )}
                </div>

                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Step 2: Copy the authorization code
                  </p>
                  <p className="text-xs text-gray-600">
                    After granting permission, copy the code from the page and paste it below.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Authorization Code
                  </label>
                  <input
                    type="text"
                    value={authCode}
                    onChange={(e) => setAuthCode(e.target.value)}
                    placeholder="Paste the authorization code here"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {error && (
                  <div className="flex items-start p-3 bg-red-50 text-red-700 rounded-lg">
                    <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{error}</span>
                  </div>
                )}

                <button
                  onClick={handleManualAuth}
                  disabled={isManualAuthenticating || !authCode.trim()}
                  className={`w-full py-3 px-4 rounded-lg text-white font-medium transition-all duration-200 ${
                    isManualAuthenticating || !authCode.trim()
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {isManualAuthenticating ? (
                    <div className="flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Authenticating...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 mr-2" />
                      Authenticate with Code
                    </div>
                  )}
                </button>

                <div className="text-center">
                  <button
                    onClick={() => {
                      setShowManualAuth(false);
                      setError('');
                      setAuthCode('');
                    }}
                    className="text-sm text-blue-600 hover:text-blue-700 underline"
                  >
                    Back to automatic authentication
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 py-2 px-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoogleAuthSetup;