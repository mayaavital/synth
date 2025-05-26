export default async function handler(req, res) {
  // Add CORS headers for cross-origin requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { query, limit = 5 } = req.query;

    if (!query) {
      res.status(400).json({ error: 'Query parameter is required' });
      return;
    }

    console.log(`[DEEZER PROXY] Searching for: "${query}" with limit: ${limit}`);

    // Make the request to Deezer API
    const deezerUrl = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=${limit}`;
    const response = await fetch(deezerUrl);

    if (!response.ok) {
      throw new Error(`Deezer API responded with status: ${response.status}`);
    }

    const data = await response.json();

    // Log the response for debugging
    console.log(`[DEEZER PROXY] Found ${data.data?.length || 0} tracks`);

    // Set cache headers for performance
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
    
    // Return the data
    res.status(200).json(data);

  } catch (error) {
    console.error('[DEEZER PROXY] Error:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch from Deezer API',
      message: error.message 
    });
  }
} 