const { google } = require("googleapis");
const CREDENTIALS = require("../credentials.cjs");

/**
 * Validates that Google API credentials are configured.
 * @returns {{ valid: boolean, error?: string }}
 */
function validateCredentials() {
  if (
    !CREDENTIALS.client_id ||
    CREDENTIALS.client_id === "YOUR_CLIENT_ID.apps.googleusercontent.com"
  ) {
    return {
      valid: false,
      error:
        "Google Drive API credentials not configured. Please set up your client_id and client_secret in the .env file.",
    };
  }
  return { valid: true };
}

/**
 * Creates and returns an authenticated OAuth2 client.
 * @param {object} [tokens] - Optional tokens to set on the client.
 * @returns {import('googleapis').Auth.OAuth2Client}
 */
function createOAuth2Client(tokens) {
  const oauth2Client = new google.auth.OAuth2(
    CREDENTIALS.client_id,
    CREDENTIALS.client_secret,
    CREDENTIALS.redirect_uris[0],
  );

  if (tokens) {
    oauth2Client.setCredentials(tokens);
  }

  return oauth2Client;
}

/**
 * Creates an authenticated Google Drive API instance.
 * @param {object} tokens - OAuth2 tokens.
 * @returns {import('googleapis').drive_v3.Drive}
 */
function createDriveClient(tokens) {
  const oauth2Client = createOAuth2Client(tokens);
  return google.drive({ version: "v3", auth: oauth2Client });
}

/**
 * Google OAuth2 scopes required by the application.
 */
const OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/userinfo.email",
];

module.exports = {
  validateCredentials,
  createOAuth2Client,
  createDriveClient,
  OAUTH_SCOPES,
};
