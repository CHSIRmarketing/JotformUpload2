exports.handler = async (event) => {
    // Handle CORS for browser requests
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle OPTIONS request for CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers,
            body: ''
        };
    }

    // Only allow GET requests
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({error: 'Method Not Allowed'})
        };
    }

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            device_id: localStorage.getItem('deviceId'),
        })
    };
}
