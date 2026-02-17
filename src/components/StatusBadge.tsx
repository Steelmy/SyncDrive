import React from 'react';
import { ArrowUpFromLine, ArrowDownToLine, AlertCircle, Check, Archive, Package, FolderOpen } from 'lucide-react';

interface StatusBadgeProps {
  status: 'upload' | 'download' | 'none' | 'error' | 'backup' | 'zip' | 'extract';
  size?: 'sm' | 'md';
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const sizeClasses = size === 'sm' 
    ? 'py-0.5 px-2 text-xs' 
    : 'py-1 px-3 text-sm';
  
  switch (status) {
    case 'upload':
      return (
        <span className={`inline-flex items-center rounded-full bg-indigo-100 text-indigo-700 ${sizeClasses}`}>
          <ArrowUpFromLine className={size === 'sm' ? 'h-3 w-3 mr-1' : 'h-4 w-4 mr-1'} />
          Uploaded
        </span>
      );
    case 'download':
      return (
        <span className={`inline-flex items-center rounded-full bg-blue-100 text-blue-700 ${sizeClasses}`}>
          <ArrowDownToLine className={size === 'sm' ? 'h-3 w-3 mr-1' : 'h-4 w-4 mr-1'} />
          Downloaded
        </span>
      );
    case 'backup':
      return (
        <span className={`inline-flex items-center rounded-full bg-orange-100 text-orange-700 ${sizeClasses}`}>
          <Archive className={size === 'sm' ? 'h-3 w-3 mr-1' : 'h-4 w-4 mr-1'} />
          Backed up
        </span>
      );
    case 'zip':
      return (
        <span className={`inline-flex items-center rounded-full bg-purple-100 text-purple-700 ${sizeClasses}`}>
          <Package className={size === 'sm' ? 'h-3 w-3 mr-1' : 'h-4 w-4 mr-1'} />
          Zipped
        </span>
      );
    case 'extract':
      return (
        <span className={`inline-flex items-center rounded-full bg-teal-100 text-teal-700 ${sizeClasses}`}>
          <FolderOpen className={size === 'sm' ? 'h-3 w-3 mr-1' : 'h-4 w-4 mr-1'} />
          Extracted
        </span>
      );
    case 'none':
      return (
        <span className={`inline-flex items-center rounded-full bg-green-100 text-green-700 ${sizeClasses}`}>
          <Check className={size === 'sm' ? 'h-3 w-3 mr-1' : 'h-4 w-4 mr-1'} />
          In Sync
        </span>
      );
    case 'error':
      return (
        <span className={`inline-flex items-center rounded-full bg-red-100 text-red-700 ${sizeClasses}`}>
          <AlertCircle className={size === 'sm' ? 'h-3 w-3 mr-1' : 'h-4 w-4 mr-1'} />
          Error
        </span>
      );
    default:
      return null;
  }
};

export default StatusBadge;