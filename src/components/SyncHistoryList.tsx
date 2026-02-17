import React from 'react';
import { Clock, FileText } from 'lucide-react';
import { SyncRecord } from '../types';
import StatusBadge from './StatusBadge';

interface SyncHistoryListProps {
  history: SyncRecord[];
}

const SyncHistoryList: React.FC<SyncHistoryListProps> = ({ history }) => {
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-4">
      {history.map((record, index) => (
        <div key={index} className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                record.success 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-red-100 text-red-700'
              }`}>
                {record.success ? 'Success' : 'Error'}
              </span>
              <span className="text-sm text-gray-600">{record.message}</span>
            </div>
            <div className="flex items-center text-gray-500 text-sm">
              <Clock className="w-4 h-4 mr-1" />
              {formatTime(record.timestamp)}
            </div>
          </div>
          
          {record.results && record.results.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700 flex items-center">
                <FileText className="w-4 h-4 mr-1" />
                Files ({record.results.length})
              </h4>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {record.results.map((result, resultIndex) => (
                  <div key={resultIndex} className="flex items-center justify-between bg-gray-50 p-2 rounded text-sm">
                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                      <StatusBadge status={result.action} size="sm" />
                      <span className="text-gray-600 truncate">{result.message}</span>
                    </div>
                    {result.filePath && (
                      <span className="text-xs text-gray-500 font-mono ml-2 flex-shrink-0">
                        {result.filePath.split('/').pop() || result.filePath}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default SyncHistoryList;