export interface Instance {
  id: string;
  name: string;
  rootDirectory: string | null;
  isAuthenticated: boolean;
  userInfo: {
    email: string;
    name: string;
    picture?: string;
  } | null;
  tokens: any;
  syncInterval: number; // in milliseconds
  lastSyncTime: string | null;
  syncHistory: SyncRecord[];
  zipMode: boolean; // Field for ZIP mode
  autoSyncEnabled: boolean; // New field for auto-sync toggle
  driveFolderId: string | null; // ID of the instance folder in Drive
  currentFolderId: string | null; // ID of the current folder in Drive
  backupFolderId: string | null; // ID of the backup folder in Drive
  backupLocalFolderId: string | null; // ID of the backup-local folder in Drive
  downloadPath: string | null; // Download destination path
  downloadUnzip: boolean; // Whether to unzip downloaded files
  downloadReplace: boolean; // Whether to replace existing files
}

export interface AppConfig {
  instances: Instance[];
  currentInstanceId: string | null;
  hasCompletedSetup: boolean;
}

export interface SyncRecord {
  timestamp: string;
  results: SyncResult[];
  success: boolean;
  message: string;
}

export interface SyncResult {
  action: 'upload' | 'download' | 'none' | 'error' | 'backup' | 'zip' | 'extract';
  message: string;
  filePath: string;
}

export interface SyncHistory {
  timestamp: string;
  action: 'upload' | 'download' | 'none' | 'error' | 'backup' | 'zip' | 'extract';
  success: boolean;
  message: string;
  filePath?: string;
}

export interface DownloadOptions {
  downloadPath?: string;
  unzipFiles?: boolean;
  replaceFiles?: boolean;
}

declare global {
  interface Window {
    electronAPI: {
      // Instance management
      createInstance: (name: string) => Promise<Instance>;
      switchInstance: (instanceId: string) => Promise<boolean>;
      deleteInstance: (instanceId: string) => Promise<Instance[]>;
      renameInstance: (instanceId: string, newName: string) => Promise<boolean>;
      
      // Directory management
      selectDirectory: (instanceId: string) => Promise<string | null>;
      updateDirectoryPath: (instanceId: string, newPath: string) => Promise<{
        success: boolean;
        path?: string;
        error?: string;
      }>;
      selectDownloadDirectory: (instanceId: string) => Promise<string | null>;
      updateDownloadSettings: (instanceId: string, settings: {
        downloadPath?: string;
        downloadUnzip?: boolean;
        downloadReplace?: boolean;
      }) => Promise<boolean>;
      
      // Sync settings
      updateSyncInterval: (instanceId: string, intervalMinutes: number) => Promise<boolean>;
      updateZipMode: (instanceId: string, zipMode: boolean) => Promise<boolean>;
      updateAutoSync: (instanceId: string, enabled: boolean) => Promise<boolean>;
      
      // Google authentication
      getGoogleAuthUrl: (instanceId: string) => Promise<{
        success: boolean;
        authUrl?: string;
        error?: string;
      }>;
      authenticateWithCode: (instanceId: string, authCode: string) => Promise<{
        success: boolean;
        userInfo?: any;
        tokens?: any;
        error?: string;
      }>;
      authenticateGoogle: (instanceId: string) => Promise<{
        success: boolean;
        userInfo?: any;
        tokens?: any;
        error?: string;
      }>;
      logoutGoogle: (instanceId: string) => Promise<boolean>;
      
      // Sync operations
      syncNow: (instanceId: string) => Promise<{
        success: boolean;
        message: string;
        results?: SyncResult[];
      }>;
      downloadFromDrive: (instanceId: string, options?: DownloadOptions) => Promise<{
        success: boolean;
        message: string;
        results?: SyncResult[];
        zipPath?: string;
        isNewerLocal?: boolean;
      }>;
      getConfig: () => Promise<AppConfig>;
      
      // Event listeners
      onConfigLoaded: (callback: (data: AppConfig) => void) => void;
      onSyncCompleted: (callback: (data: {
        instanceId: string;
        success: boolean;
        message: string;
        history?: SyncRecord[];
      }) => void) => void;
    };
  }
}