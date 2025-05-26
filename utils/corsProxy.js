/**
 * Standalone CORS proxy utility for Deezer API
 * This provides additional fallback options when traditional CORS proxies fail
 */

/**
 * Try to use a serverless function as CORS proxy (if deployed)
 * @param {string} url - The URL to proxy
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} - Response data
 */
export const serverlessProxy = async (url, params = {}) => {
  try {
    // Check if we're running in a browser environment
    if (typeof window === 'undefined') {
      throw new Error('Serverless proxy only available in browser');
    }
    
    // This would be your own Vercel serverless function
    const proxyUrl = '/api/cors-proxy';
    
    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url,
        params: params,
      }),
    });
    
    if (response.ok) {
      return await response.json();
    }
    
    throw new Error(`Serverless proxy failed: ${response.status}`);
  } catch (error) {
    console.log('Serverless proxy not available:', error.message);
    throw error;
  }
};

/**
 * Use browser's fetch with no-cors mode (limited but sometimes works)
 * @param {string} url - The URL to fetch
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} - Response data (may be limited)
 */
export const noCorsProxy = async (url, params = {}) => {
  try {
    if (typeof window === 'undefined' || typeof fetch === 'undefined') {
      throw new Error('No-cors proxy only available in browser with fetch API');
    }
    
    const queryString = new URLSearchParams(params).toString();
    const fullUrl = `${url}?${queryString}`;
    
    console.log('Trying no-cors fetch:', fullUrl);
    
    const response = await fetch(fullUrl, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-cache',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    // With no-cors, we can't read the response body
    // This is mainly for requests that might work in some edge cases
    if (response.type === 'opaque') {
      console.log('No-cors request completed but response is opaque');
      throw new Error('No-cors response is opaque - cannot read data');
    }
    
    return await response.json();
  } catch (error) {
    console.log('No-cors proxy failed:', error.message);
    throw error;
  }
};

/**
 * Image proxy technique - sometimes images can bypass CORS
 * This is a hack that occasionally works for APIs that return JSONP
 * @param {string} url - The URL to proxy
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} - Response data
 */
export const imageProxy = async (url, params = {}) => {
  return new Promise((resolve, reject) => {
    try {
      if (typeof window === 'undefined' || typeof document === 'undefined') {
        throw new Error('Image proxy only available in browser');
      }
      
      // Add JSONP callback to params
      const callbackName = `jsonp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const jsonpParams = {
        ...params,
        output: 'jsonp',
        callback: callbackName,
      };
      
      const queryString = new URLSearchParams(jsonpParams).toString();
      const fullUrl = `${url}?${queryString}`;
      
      // Set up callback
      window[callbackName] = (data) => {
        delete window[callbackName];
        resolve(data);
      };
      
      // Try to load as script (JSONP style)
      const script = document.createElement('script');
      script.src = fullUrl;
      script.onload = () => {
        try {
          document.head.removeChild(script);
        } catch (e) {
          // Script might already be removed
        }
      };
      script.onerror = () => {
        try {
          document.head.removeChild(script);
        } catch (e) {
          // Script might already be removed
        }
        delete window[callbackName];
        reject(new Error('Image proxy script load failed'));
      };
      
      document.head.appendChild(script);
      
      // Timeout
      setTimeout(() => {
        if (window[callbackName]) {
          try {
            document.head.removeChild(script);
          } catch (e) {
            // Script might already be removed
          }
          delete window[callbackName];
          reject(new Error('Image proxy timeout'));
        }
      }, 5000);
      
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * WebWorker proxy - try to make requests from a web worker
 * Sometimes web workers have different CORS policies
 * @param {string} url - The URL to proxy
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} - Response data
 */
export const webWorkerProxy = async (url, params = {}) => {
  return new Promise((resolve, reject) => {
    try {
      if (typeof window === 'undefined' || typeof Worker === 'undefined') {
        throw new Error('WebWorker proxy only available in browser with Worker support');
      }
      
      // Create a simple web worker inline
      const workerScript = `
        self.onmessage = function(e) {
          const { url, params } = e.data;
          const queryString = new URLSearchParams(params).toString();
          const fullUrl = url + '?' + queryString;
          
          fetch(fullUrl)
            .then(response => response.json())
            .then(data => {
              self.postMessage({ success: true, data: data });
            })
            .catch(error => {
              self.postMessage({ success: false, error: error.message });
            });
        };
      `;
      
      const blob = new Blob([workerScript], { type: 'application/javascript' });
      const worker = new Worker(URL.createObjectURL(blob));
      
      worker.onmessage = function(e) {
        worker.terminate();
        URL.revokeObjectURL(blob);
        
        if (e.data.success) {
          resolve(e.data.data);
        } else {
          reject(new Error(e.data.error));
        }
      };
      
      worker.onerror = function(error) {
        worker.terminate();
        URL.revokeObjectURL(blob);
        reject(error);
      };
      
      // Send request to worker
      worker.postMessage({ url, params });
      
      // Timeout
      setTimeout(() => {
        worker.terminate();
        URL.revokeObjectURL(blob);
        reject(new Error('WebWorker proxy timeout'));
      }, 10000);
      
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * List of alternative proxy strategies
 */
export const proxyStrategies = [
  {
    name: 'Serverless Function',
    func: serverlessProxy,
    description: 'Use your own Vercel serverless function as CORS proxy',
  },
  {
    name: 'Image Proxy',
    func: imageProxy,
    description: 'Use image loading technique for JSONP requests',
  },
  {
    name: 'WebWorker',
    func: webWorkerProxy,
    description: 'Try making requests from a Web Worker',
  },
  {
    name: 'No-CORS',
    func: noCorsProxy,
    description: 'Browser fetch with no-cors mode',
  },
];

/**
 * Try all alternative proxy strategies in sequence
 * @param {string} url - The URL to proxy
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} - Response data from first successful strategy
 */
export const tryAllProxyStrategies = async (url, params = {}) => {
  console.log('Trying alternative proxy strategies...');
  
  for (const strategy of proxyStrategies) {
    try {
      console.log(`Trying ${strategy.name}: ${strategy.description}`);
      const result = await strategy.func(url, params);
      
      if (result && (result.data || result.id)) {
        console.log(`✅ ${strategy.name} succeeded`);
        return result;
      }
    } catch (error) {
      console.log(`❌ ${strategy.name} failed:`, error.message);
    }
  }
  
  throw new Error('All alternative proxy strategies failed');
}; 