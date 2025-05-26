/**
 * Vercel Serverless Function - CORS Proxy for Deezer API
 * This allows your frontend to make requests to Deezer API through your own backend
 */

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST requests with the proxy data
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { url, params } = req.body;

    // Validate the URL is for Deezer API
    if (!url || !url.includes('api.deezer.com')) {
      return res.status(400).json({ error: 'Invalid URL - only Deezer API URLs are allowed' });
    }

    // Build the query string
    const queryString = new URLSearchParams(params).toString();
    const fullUrl = `${url}?${queryString}`;

    console.log('Proxying request to:', fullUrl);

    // Make the request to Deezer API
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Synth Music Game/1.0',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Deezer API responded with ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Log success for debugging
    console.log('Proxy request successful, data length:', data?.data?.length || 'N/A');

    // Return the data
    res.status(200).json(data);

  } catch (error) {
    console.error('CORS Proxy Error:', error);
    res.status(500).json({ 
      error: 'Proxy request failed', 
      message: error.message 
    });
  }
} 