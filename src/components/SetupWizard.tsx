import React, { useState } from 'react';
import { FolderOpen, HardDrive, Plus } from 'lucide-react';

interface SetupWizardProps {
  onDirectorySelected: () => void;
}

const SetupWizard: React.FC<SetupWizardProps> = ({ onDirectorySelected }) => {
  const [instanceName, setInstanceName] = useState('My First Instance');
  const [isCreating, setIsCreating] = useState(false);
  const [step, setStep] = useState(1);
  
  const handleCreateInstance = async () => {
    setIsCreating(true);
    try {
      await window.electronAPI.createInstance(instanceName);
      setStep(2);
      onDirectorySelected();
    } catch (error) {
      console.error('Failed to create instance:', error);
    } finally {
      setIsCreating(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden transition-all duration-300 transform">
        <div className="bg-blue-600 p-6 text-white">
          <h1 className="text-2xl font-bold">Welcome to Drive Sync</h1>
          <p className="mt-2 opacity-90">Let's create your first sync instance</p>
        </div>
        
        <div className="p-6">
          {step === 1 ? (
            <div className="space-y-6">
              <div className="text-center py-6">
                <Plus className="mx-auto h-16 w-16 text-blue-600 mb-4" />
                <h2 className="text-xl font-semibold text-gray-800">Create Your First Instance</h2>
                <p className="mt-2 text-gray-600">
                  Each instance can sync with a different Google Drive account and folder.
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Instance Name
                </label>
                <input
                  type="text"
                  value={instanceName}
                  onChange={(e) => setInstanceName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter instance name"
                />
              </div>
              
              <button
                onClick={handleCreateInstance}
                disabled={isCreating || !instanceName.trim()}
                className={`w-full py-3 px-4 flex items-center justify-center rounded-lg text-white font-medium transition-all duration-200 ${
                  isCreating || !instanceName.trim()
                    ? 'bg-blue-400 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
                }`}
              >
                {isCreating ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Creating Instance...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-5 w-5" />
                    Create Instance
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
              
              <h2 className="text-xl font-semibold text-gray-800">Instance Created!</h2>
              
              <p className="text-gray-600">
                Your instance "{instanceName}" has been created successfully.
              </p>
              
              <p className="text-gray-600 mt-4">
                You can now configure your Google Drive authentication and select a directory to sync.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SetupWizard;