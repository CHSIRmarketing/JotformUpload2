const fetch = require('node-fetch');

// WARNING: Hardcoding secrets is insecure! Only for testing purposes.
// Replace these with your actual Dropbox OAuth 2.0 credentials
const DROPBOX_REFRESH_TOKEN = process.env.DROPBOX_REFRESH_TOKEN;
const DROPBOX_APP_KEY = process.env.DROPBOX_APP_KEY;
const DROPBOX_APP_SECRET = process.env.DROPBOX_APP_SECRET;

const DROPBOX_API_UPLOAD = 'https://content.dropboxapi.com/2/files/upload';
const DROPBOX_API_DOWNLOAD = 'https://content.dropboxapi.com/2/files/download';
const DROPBOX_PATH = '/Listings/address.json';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

// Simple rate limiter - track last upload time
let lastUploadTime = 0;
const MIN_UPLOAD_INTERVAL = 1000; // 1 second minimum between uploads

// Helper function to delay execution
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function to get a fresh access token using refresh token
async function getDropboxAccessToken() {
  try {
    const auth = Buffer.from(`${DROPBOX_APP_KEY}:${DROPBOX_APP_SECRET}`).toString('base64');
    const res = await fetch('https://api.dropbox.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `grant_type=refresh_token&refresh_token=${DROPBOX_REFRESH_TOKEN}`
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to refresh Dropbox access token: ${errorText}`);
    }
    
    const data = await res.json();
    return data.access_token;
  } catch (error) {
    console.error('Error getting Dropbox access token:', error);
    throw error;
  }
}

// Helper function to upload with retry logic
async function uploadToDropboxWithRetry(accessToken, data, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Rate limiting - ensure minimum interval between uploads
      const now = Date.now();
      const timeSinceLastUpload = now - lastUploadTime;
      if (timeSinceLastUpload < MIN_UPLOAD_INTERVAL) {
        const waitTime = MIN_UPLOAD_INTERVAL - timeSinceLastUpload;
        console.log(`Rate limiting: waiting ${waitTime}ms before upload`);
        await delay(waitTime);
      }

      const uploadRes = await fetch(DROPBOX_API_UPLOAD, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Dropbox-API-Arg': JSON.stringify({ path: DROPBOX_PATH, mode: 'overwrite', mute: true }),
          'Content-Type': 'application/octet-stream'
        },
        body: JSON.stringify(data)
      });

      if (uploadRes.ok) {
        lastUploadTime = Date.now();
        return uploadRes;
      }

      const errorData = await uploadRes.json();
      
      // Check if it's a rate limit error
      if (errorData.error && errorData.error.reason && errorData.error.reason['.tag'] === 'too_many_write_operations') {
        const retryAfter = errorData.error.retry_after || 1;
        console.log(`Rate limited. Retrying after ${retryAfter} seconds (attempt ${attempt}/${maxRetries})`);
        
        if (attempt < maxRetries) {
          await delay(retryAfter * 1000);
          continue;
        }
      }

      // If it's not a rate limit error or we've exhausted retries, throw the error
      throw new Error(`Upload failed: ${JSON.stringify(errorData)}`);

    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      console.log(`Upload attempt ${attempt} failed, retrying...`);
      await delay(1000 * attempt); // Exponential backoff
    }
  }
}

exports.handler = async function(event, context) {
  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: ''
    };
  }

  if (!DROPBOX_REFRESH_TOKEN || !DROPBOX_APP_KEY || !DROPBOX_APP_SECRET) {
    return { 
      statusCode: 500, 
      headers: CORS_HEADERS, 
      body: JSON.stringify({ error: 'Missing Dropbox OAuth credentials' }) 
    };
  }

  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body);
      // Accept both address and unitNumber
      const address = body.address || null;
      const unitNumber = body.unitNumber || null;
      if (!address && !unitNumber) {
        return { 
          statusCode: 400, 
          headers: CORS_HEADERS, 
          body: JSON.stringify({ error: 'Missing address and unitNumber' }) 
        };
      }

      // Get fresh access token
      const accessToken = await getDropboxAccessToken();

      // Download current data from Dropbox (if exists)
      let currentData = {};
      try {
        const downloadRes = await fetch(DROPBOX_API_DOWNLOAD, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Dropbox-API-Arg': JSON.stringify({ path: DROPBOX_PATH })
          }
        });
        if (downloadRes.ok) {
          currentData = await downloadRes.json();
        }
      } catch (e) { 
        // ignore if file does not exist 
        console.log('No existing file found, creating new one');
      }

      // Update fields
      if (address !== null) currentData.address = address;
      if (unitNumber !== null) currentData.unitNumber = unitNumber;

      // Save to Dropbox with retry logic
      await uploadToDropboxWithRetry(accessToken, currentData);

      return { 
        statusCode: 200, 
        headers: CORS_HEADERS, 
        body: JSON.stringify({ success: true }) 
      };
    } catch (err) {
      return { 
        statusCode: 500, 
        headers: CORS_HEADERS, 
        body: JSON.stringify({ error: err.message }) 
      };
    }
  }

  if (event.httpMethod === 'GET') {
    try {
      // Get fresh access token
      const accessToken = await getDropboxAccessToken();

      // Read from Dropbox
      const downloadRes = await fetch(DROPBOX_API_DOWNLOAD, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Dropbox-API-Arg': JSON.stringify({ path: DROPBOX_PATH })
        }
      });

      if (!downloadRes.ok) {
        return { 
          statusCode: 404, 
          headers: CORS_HEADERS, 
          body: JSON.stringify({ error: 'No data found' }) 
        };
      }

      const data = await downloadRes.text();
      return { 
        statusCode: 200, 
        headers: CORS_HEADERS, 
        body: data 
      };
    } catch (err) {
      return { 
        statusCode: 500, 
        headers: CORS_HEADERS, 
        body: JSON.stringify({ error: err.message }) 
      };
    }
  }

  return { 
    statusCode: 405, 
    headers: CORS_HEADERS, 
    body: JSON.stringify({ error: 'Method Not Allowed' }) 
  };
};
