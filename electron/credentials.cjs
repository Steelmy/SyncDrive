// Google Drive API credentials - REPLACE WITH YOUR ACTUAL CREDENTIALS
const CREDENTIALS = {
  client_id: process.env.GOOGLE_CLIENT_ID,
  client_secret: process.env.GOOGLE_CLIENT_SECRET,
  redirect_uris: [process.env.GOOGLE_REDIRECT_URI]
};

module.exports = CREDENTIALS;