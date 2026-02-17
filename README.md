# Drive Sync - Electron Application

A desktop application that automatically synchronizes local files with Google Drive, supporting multiple instances with different Google accounts and directories.

## Features

- **Multiple Instances**: Create and manage multiple sync instances, each with its own Google Drive account and local directory
- **Automatic Synchronization**: Files are automatically synced at configurable intervals (default: 5 minutes)
- **Manual Sync**: Trigger immediate synchronization when needed
- **Bidirectional Sync**: Upload newer local files to Drive and download newer Drive files locally
- **Sync History**: View detailed history of all sync operations
- **User-Friendly Interface**: Modern, responsive UI built with React and Tailwind CSS

## Setup Instructions

### 1. Google Drive API Setup

Before using the application, you need to set up Google Drive API credentials:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Drive API for your project
4. Go to "Credentials" and create an OAuth 2.0 Client ID
5. Set the authorized redirect URI to: `http://localhost:3000/oauth2callback`
6. Download the credentials JSON file

### 2. Configure Credentials

Open `electron/main.cjs` and replace the placeholder credentials:

```javascript
const CREDENTIALS = {
  client_id: 'YOUR_CLIENT_ID.apps.googleusercontent.com',
  client_secret: 'YOUR_CLIENT_SECRET',
  redirect_uris: ['http://localhost:3000/oauth2callback']
};
```

Replace `YOUR_CLIENT_ID` and `YOUR_CLIENT_SECRET` with your actual Google API credentials.

### 3. Install Dependencies

```bash
npm install
```

### 4. Run the Application

For development:
```bash
npm run electron:dev
```

For production build:
```bash
npm run build
npm run electron:build
```

## Usage

### First Launch

1. The application will show a setup wizard
2. Create your first instance by entering a name
3. Select a local directory to sync
4. Authenticate with your Google Drive account

### Managing Instances

- **Create Instance**: Click "New Instance" to add another sync configuration
- **Switch Instance**: Click on any instance card to make it active
- **Delete Instance**: Use the trash icon to remove an instance (requires confirmation)

### Authentication

The application supports two authentication methods:

1. **Automatic**: Opens your browser for OAuth flow (recommended)
2. **Manual**: Copy/paste authorization code if automatic method fails

### Settings

Access settings to:
- Change the local directory path
- Modify sync interval (in minutes)
- View account information
- Logout from Google Drive

### Sync Operations

- **Automatic Sync**: Runs at the configured interval for authenticated instances
- **Manual Sync**: Click "Sync Now" to trigger immediate synchronization
- **Sync History**: View detailed logs of all sync operations

## File Synchronization Logic

- **Upload**: Local files newer than Drive files are uploaded
- **Download**: Drive files newer than local files are downloaded
- **New Files**: Files that don't exist on Drive are uploaded
- **In Sync**: Files with matching modification times are left unchanged

## Troubleshooting

### Authentication Issues

1. Verify your Google API credentials are correctly configured
2. Ensure the redirect URI matches exactly: `http://localhost:3000/oauth2callback`
3. Try manual authentication if automatic fails
4. Check that port 3000 is not blocked by firewall

### Sync Issues

1. Verify the local directory exists and is accessible
2. Check Google Drive API quotas and limits
3. Ensure stable internet connection
4. Review sync history for specific error messages

### Common Errors

- **"Credentials not configured"**: Update the credentials in `electron/main.cjs`
- **"Path does not exist"**: Verify the local directory path is valid
- **"Authentication timeout"**: Try manual authentication method

## Development

### Project Structure

```
├── electron/
│   ├── main.cjs          # Main Electron process
│   └── preload.js        # Preload script for IPC
├── src/
│   ├── components/       # React components
│   ├── types.ts         # TypeScript type definitions
│   └── App.tsx          # Main React application
└── package.json         # Dependencies and scripts
```

### Key Technologies

- **Electron**: Desktop application framework
- **React**: UI framework
- **TypeScript**: Type-safe JavaScript
- **Tailwind CSS**: Utility-first CSS framework
- **Google APIs**: Drive API integration
- **Electron Store**: Persistent configuration storage

## License

This project is licensed under the MIT License.