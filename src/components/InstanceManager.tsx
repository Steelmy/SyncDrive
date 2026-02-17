import React, { useState } from 'react';
import { Plus, Trash2, Users, Edit3, Check, X } from 'lucide-react';
import { Instance } from '../types';

interface InstanceManagerProps {
  instances: Instance[];
  currentInstanceId: string | null;
  onSwitchInstance: (instanceId: string) => void;
  onCreateInstance: (name: string) => void;
  onDeleteInstance: (instanceId: string) => void;
}

const InstanceManager: React.FC<InstanceManagerProps> = ({
  instances,
  currentInstanceId,
  onSwitchInstance,
  onCreateInstance,
  onDeleteInstance
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState('');
  const [editingInstanceId, setEditingInstanceId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleCreateInstance = () => {
    if (newInstanceName.trim()) {
      onCreateInstance(newInstanceName.trim());
      setNewInstanceName('');
      setIsCreating(false);
    }
  };

  const handleDeleteInstance = (instanceId: string) => {
    if (instances.length > 1 && confirm('Are you sure you want to delete this instance?')) {
      onDeleteInstance(instanceId);
    }
  };

  const handleStartRename = (instance: Instance) => {
    setEditingInstanceId(instance.id);
    setEditingName(instance.name);
  };

  const handleSaveRename = async () => {
    if (editingInstanceId && editingName.trim()) {
      try {
        const success = await window.electronAPI.renameInstance(editingInstanceId, editingName.trim());
        if (success) {
          // Refresh the page to update the UI
          window.location.reload();
        }
      } catch (error) {
        console.error('Failed to rename instance:', error);
      }
    }
    setEditingInstanceId(null);
    setEditingName('');
  };

  const handleCancelRename = () => {
    setEditingInstanceId(null);
    setEditingName('');
  };

  const getRootDirectory = (instanceIndex: number) => {
    const instance = instances[instanceIndex]
    const rootDirectory = instance.rootDirectory
    if (!rootDirectory) {
      return "No root directory found"
    }

    return rootDirectory.length > 60 ? rootDirectory.substring(0, 30) + "..." + rootDirectory.substring(rootDirectory.length-30, rootDirectory.length) : rootDirectory
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium text-gray-800 flex items-center">
          <Users className="h-5 w-5 mr-2 text-blue-600" />
          Instances
        </h2>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
        >
          <Plus className="h-4 w-4 mr-1" />
          New Instance
        </button>
      </div>

      {isCreating && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex gap-2">
            <input
              type="text"
              value={newInstanceName}
              onChange={(e) => setNewInstanceName(e.target.value)}
              placeholder="Instance name"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onKeyPress={(e) => e.key === 'Enter' && handleCreateInstance()}
              autoFocus
            />
            <button
              onClick={handleCreateInstance}
              disabled={!newInstanceName.trim()}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors"
            >
              Create
            </button>
            <button
              onClick={() => {
                setIsCreating(false);
                setNewInstanceName('');
              }}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {instances.map((instance, index) => (
          <div
            key={instance.id}
            className={`p-4 rounded-lg border-2 transition-all ${
              currentInstanceId === instance.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
          >
            <div className="flex items-center justify-between">
              <div 
                className="flex-1 cursor-pointer"
                onClick={() => editingInstanceId !== instance.id && onSwitchInstance(instance.id)}
              >
                <div className="flex items-center gap-3">
                  {editingInstanceId === instance.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        onKeyPress={(e) => e.key === 'Enter' && handleSaveRename()}
                        autoFocus
                      />
                      <button
                        onClick={handleSaveRename}
                        className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                        title="Save"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={handleCancelRename}
                        className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Cancel"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <h3 className="font-medium text-gray-800">{instance.name}</h3>
                  )}
                  
                  {editingInstanceId !== instance.id && (
                    <>
                      {instance.isAuthenticated && (
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                          Connected
                        </span>
                      )}
                      {currentInstanceId === instance.id && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                          Active
                        </span>
                      )}
                      {instance.autoSyncEnabled === false && (
                        <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-full">
                          Auto-sync Off
                        </span>
                      )}
                    </>
                  )}
                </div>
                
                {editingInstanceId !== instance.id && (
                  <>
                    <div className="mt-1 text-sm text-gray-600">
                      {instance.userInfo ? (
                        <span>{instance.userInfo.email}</span>
                      ) : (
                        <span>Not authenticated</span>
                      )}
                    </div>
                    {instance.rootDirectory && (
                      <div className="mt-1 text-xs text-gray-500 font-mono" title={instance.rootDirectory}>
                        {getRootDirectory(index)}
                      </div>
                    )}
                  </>
                )}
              </div>
              
              {editingInstanceId !== instance.id && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartRename(instance);
                    }}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Rename instance"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  
                  {instances.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteInstance(instance.id);
                      }}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete instance"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default InstanceManager;