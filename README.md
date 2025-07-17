# Address Storage Backend

An Express.js backend that stores address data in a JSON file on Dropbox.

## Features

- Store address data (addressNumber, unitNumber) in Dropbox
- RESTful API endpoints
- CORS enabled for cross-origin requests
- Fallback to in-memory storage if Dropbox is not configured
- Health check endpoint

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Dropbox

1. Go to [Dropbox App Console](https://www.dropbox.com/developers/apps)
2. Create a new app
3. Choose "Dropbox API" and "Full Dropbox" access
4. Generate an access token
5. Create a `.env` file in the root directory:

```env
DROPBOX_ACCESS_TOKEN=your_dropbox_access_token_here
PORT=3000
```

### 3. Start the Server

```bash
# Development mode (with auto-restart)
npm run dev

# Production mode
npm start
```

## API Endpoints

### Store Address Data
```
POST /api/address
Content-Type: application/json

{
  "addressNumber": "123 Main St",
  "unitNumber": "Apt 4B",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Get All Addresses
```
GET /api/addresses
```

### Health Check
```
GET /health
```

### API Info
```
GET /
```

## Response Format

### Success Response
```json
{
  "success": true,
  "message": "Address data saved to Dropbox successfully",
  "data": {
    "addressNumber": "123 Main St",
    "unitNumber": "Apt 4B",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "id": "1705312200000"
  },
  "storageType": "dropbox",
  "totalEntries": 1,
  "filePath": "/addresses.json"
}
```

## Dropbox File Structure

The data is stored in `/addresses.json` in your Dropbox root folder:

```json
[
  {
    "addressNumber": "123 Main St",
    "unitNumber": "Apt 4B",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "id": "1705312200000"
  }
]
```

## Frontend Integration

Update your frontend code to call the new backend:

```javascript
async function saveAddressData(addressNumber, unitNumber) {
  try {
    const response = await fetch('http://localhost:3000/api/address', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        addressNumber: addressNumber,
        unitNumber: unitNumber,
        timestamp: new Date().toISOString()
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log("Address data saved successfully:", result.data);
      console.log("Storage type:", result.storageType);
      console.log("Total entries:", result.totalEntries);
    } else {
      console.error("Failed to save address data:", result.error);
    }
  } catch (error) {
    console.error("Error saving address data:", error);
  }
}
```

## Environment Variables

- `DROPBOX_ACCESS_TOKEN`: Your Dropbox API access token
- `PORT`: Server port (default: 3000)

## Development

The server will run on `http://localhost:3000` by default.

For production deployment, consider using:
- Heroku
- Railway
- DigitalOcean
- AWS EC2
- Google Cloud Platform 