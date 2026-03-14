// Global State
let allData = [];
let currentUser = null;
let isAdmin = false;
let charts = {};
let navigationHistory = []; // Track navigation history for back button
let currentPage = 'home'; // Track current page

// Admin Remember Me functionality
const ADMIN_REMEMBER_KEY = 'adminRememberMe';
const ADMIN_CREDENTIALS_KEY = 'adminCredentials';

// Save admin credentials to localStorage
function saveAdminCredentials(email, password, secret, rememberMe) {
  localStorage.setItem(ADMIN_REMEMBER_KEY, rememberMe ? 'true' : 'false');
  if (rememberMe) {
    localStorage.setItem(ADMIN_CREDENTIALS_KEY, JSON.stringify({ email, password, secret }));
  } else {
    localStorage.removeItem(ADMIN_CREDENTIALS_KEY);
  }
}

// Load admin credentials from localStorage
function loadAdminCredentials() {
  const rememberMe = localStorage.getItem(ADMIN_REMEMBER_KEY) === 'true';
  if (rememberMe) {
    const credentials = localStorage.getItem(ADMIN_CREDENTIALS_KEY);
    if (credentials) {
      try {
        const creds = JSON.parse(credentials);
        document.getElementById('admin-email').value = creds.email || '';
        document.getElementById('admin-password').value = creds.password || '';
        document.getElementById('admin-secret').value = creds.secret || '';
        document.getElementById('admin-remember').checked = true;
      } catch (e) {
        console.log('Error loading admin credentials');
      }
    }
  }
}

// User lookup index for fast O(1) access
let userIndexByEmail = new Map();

// Rebuild user index when data changes
function rebuildUserIndex() {
  userIndexByEmail.clear();
  allData.forEach(d => {
    if (d.type === 'user' && d.email) {
      userIndexByEmail.set(d.email.toLowerCase(), d);
    }
  });
}

// Default Configuration
const defaultConfig = {
  app_title: 'AgriPredict',
  tagline: 'Smart Farming, Better Tomorrow',
  background_color: '#064e3b',
  primary_color: '#10b981',
  text_color: '#ffffff',
  secondary_color: '#047857',
  accent_color: '#6ee7b7'
};

// Market Data (Static Reference Data) - District -> Taluk -> Markets
const marketsByDistrict = {
  'Kolar': {
    'Kolar': ['Kolar Main Market', 'Kolar APMC', 'Kolar Wholesale'],
    'Bangarapet': ['Bangarapet Market', 'Bangarapet APMC', 'Bangarapet Wholesale'],
    'Malur': ['Malur Main Market', 'Malur APMC', 'Malur Wholesale'],
    'Mulbagal': ['Mulbagal Market', 'Mulbagal APMC', 'Mulbagal Wholesale'],
    'Srinivaspur': ['Srinivaspur Market', 'Srinivaspur APMC']
  },
  'Chikkabalpura': {
    'Chikkabalpura': ['Chikkabalpura Main', 'Chikkabalpura APMC', 'Chikkabalpura Wholesale'],
    'Bagepalli': ['Bagepalli Market', 'Bagepalli APMC'],
    'Cheemtagi': ['Cheemtagi Market', 'Cheemtagi APMC'],
    'Gudibanda': ['Gudibanda Market', 'Gudibanda APMC'],
    'Shravanabelagola': ['Shravanabelagola Market', 'Shravanabelagola APMC']
  },
  'Bangalore Rural': {
    'Bangalore Rural': ['Bangalore Rural Main', 'Bangalore Rural APMC', 'Bangalore Rural Wholesale'],
    'Devanahalli': ['Devanahalli Market', 'Devanahalli APMC', 'Devanahalli Wholesale'],
    'Doddaballapur': ['Doddaballapur Market', 'Doddaballapur APMC', 'Doddaballapur Wholesale'],
    'Hoskote': ['Hoskote Main', 'Hoskote APMC', 'Hoskote Wholesale'],
    'Nelamangala': ['Nelamangala Market', 'Nelamangala APMC']
  }
};

// Get all taluks for a district
function getTaluksByDistrict(district) {
  if (district && marketsByDistrict[district]) {
    return Object.keys(marketsByDistrict[district]);
  }
  return [];
}

// Get all markets for a taluk within a district
function getMarketsByTaluk(district, taluk) {
  if (district && marketsByDistrict[district] && marketsByDistrict[district][taluk]) {
    return marketsByDistrict[district][taluk];
  }
  return [];
}

// Get all markets for a district (all taluks combined)
function getAllMarketsByDistrict(district) {
  const allMarkets = [];
  if (district && marketsByDistrict[district]) {
    Object.values(marketsByDistrict[district]).forEach(markets => {
      allMarkets.push(...markets);
    });
  }
  return allMarkets;
}

// Get total number of markets across all districts
function getTotalMarketsCount() {
  let total = 0;
  for (const district in marketsByDistrict) {
    for (const taluk in marketsByDistrict[district]) {
      total += marketsByDistrict[district][taluk].length;
    }
  }
  return total;
}

// Update the markets available count in the user dashboard
function updateMarketsAvailableCount() {
  const marketsCountElement = document.getElementById('user-markets-available');
  if (marketsCountElement) {
    const totalMarkets = getTotalMarketsCount();
    marketsCountElement.textContent = totalMarkets;
  }
}

// Dynamically populate the Markets card in Admin Control Center
function populateMarketsCard() {
  const marketsList = document.getElementById('markets-list');
  const marketsCount = document.getElementById('markets-count');
  
  if (!marketsList) return;
  
  // Get all markets from the marketsByDistrict data
  const allMarkets = [];
  
  for (const district in marketsByDistrict) {
    const taluks = marketsByDistrict[district];
    for (const taluk in taluks) {
      const markets = taluks[taluk];
      markets.forEach(market => {
        allMarkets.push({
          name: market,
          district: district,
          taluk: taluk
        });
      });
    }
  }
  
  // Generate HTML for markets
  if (allMarkets.length > 0) {
    marketsList.innerHTML = allMarkets.map(market => `
      <div class="p-3 bg-white bg-opacity-10 rounded-xl">
<span class="text-white text-sm">${market.name}</span>
        <span class="text-purple-300 text-xs ml-2">(${market.district})</span>
      </div>
    `).join('');
  } else {
    marketsList.innerHTML = '<div class="p-3 bg-white bg-opacity-10 rounded-xl"><span class="text-white text-sm">No markets available</span></div>';
  }
  
  // Update the total count
  if (marketsCount) {
    marketsCount.textContent = `Total: ${allMarkets.length} Markets`;
  }
}

// ============================================
// DATASET - Historical Commodity Prices (2021-2025)
// ============================================
const historicalDataset = [
  {"Date": "2021-01-01", "Maize": 1957.2, "Paddy": 2190.97, "Wheat": 2272.86, "Sugarcane": 3027.39},
  {"Date": "2021-02-01", "Maize": 2002.69, "Paddy": 2028.69, "Wheat": 2461.8, "Sugarcane": 3137.59},
  {"Date": "2021-03-01", "Maize": 1961.21, "Paddy": 2138.93, "Wheat": 2291.47, "Sugarcane": 3133.54},
  {"Date": "2021-04-01", "Maize": 1977.04, "Paddy": 2209.39, "Wheat": 2280.31, "Sugarcane": 3088.66},
  {"Date": "2021-05-01", "Maize": 1836.54, "Paddy": 2170.54, "Wheat": 2462.07, "Sugarcane": 2887.97},
  {"Date": "2021-06-01", "Maize": 2013.17, "Paddy": 2190.74, "Wheat": 2347.76, "Sugarcane": 3096.76},
  {"Date": "2021-07-01", "Maize": 1930.93, "Paddy": 1990.56, "Wheat": 2408.71, "Sugarcane": 2910.62},
  {"Date": "2021-08-01", "Maize": 1839.69, "Paddy": 2170.12, "Wheat": 2527.23, "Sugarcane": 2823.13},
  {"Date": "2021-09-01", "Maize": 1933.05, "Paddy": 2076.44, "Wheat": 2397.76, "Sugarcane": 2967.79},
  {"Date": "2021-10-01", "Maize": 1808.06, "Paddy": 2088.13, "Wheat": 2397.9, "Sugarcane": 2937.62},
  {"Date": "2021-11-01", "Maize": 1949.81, "Paddy": 2221.79, "Wheat": 2501.16, "Sugarcane": 2920.21},
  {"Date": "2021-12-01", "Maize": 1797.52, "Paddy": 2096.34, "Wheat": 2352.75, "Sugarcane": 2924.31},
  {"Date": "2022-01-01", "Maize": 1876.46, "Paddy": 2177.56, "Wheat": 2568.48, "Sugarcane": 3266.7},
  {"Date": "2022-02-01", "Maize": 2014.91, "Paddy": 2122.65, "Wheat": 2546.25, "Sugarcane": 2971.23},
  {"Date": "2022-03-01", "Maize": 1877.38, "Paddy": 2166.16, "Wheat": 2519.64, "Sugarcane": 3156.55},
  {"Date": "2022-04-01", "Maize": 1909.02, "Paddy": 2217.3, "Wheat": 2428.76, "Sugarcane": 3149.45},
  {"Date": "2022-05-01", "Maize": 1905.77, "Paddy": 2304.3, "Wheat": 2553.59, "Sugarcane": 3097.38},
  {"Date": "2022-06-01", "Maize": 2053.56, "Paddy": 2160.86, "Wheat": 2608.21, "Sugarcane": 3056.98},
  {"Date": "2022-07-01", "Maize": 2089.6, "Paddy": 2142.61, "Wheat": 2431.86, "Sugarcane": 3089.27},
  {"Date": "2022-08-01", "Maize": 2030.38, "Paddy": 2196.47, "Wheat": 2415.05, "Sugarcane": 3090.05},
  {"Date": "2022-09-01", "Maize": 1906.25, "Paddy": 2120.48, "Wheat": 2579.65, "Sugarcane": 3197.35},
  {"Date": "2022-10-01", "Maize": 1992.26, "Paddy": 2294.7, "Wheat": 2393.17, "Sugarcane": 2987.1},
  {"Date": "2022-11-01", "Maize": 1866.34, "Paddy": 2146.99, "Wheat": 2439.41, "Sugarcane": 2990.85},
  {"Date": "2022-12-01", "Maize": 2080.24, "Paddy": 2255.22, "Wheat": 2439.58, "Sugarcane": 3237.68},
  {"Date": "2023-01-01", "Maize": 2120.28, "Paddy": 2240.81, "Wheat": 2614.64, "Sugarcane": 3242.74},
  {"Date": "2023-02-01", "Maize": 2136.36, "Paddy": 2235.67, "Wheat": 2679.14, "Sugarcane": 3255.61},
  {"Date": "2023-03-01", "Maize": 2044.77, "Paddy": 2178.75, "Wheat": 2645.53, "Sugarcane": 3301.19},
  {"Date": "2023-04-01", "Maize": 2093.89, "Paddy": 2206.01, "Wheat": 2671.6, "Sugarcane": 3411.08},
  {"Date": "2023-05-01", "Maize": 2099.68, "Paddy": 2266.61, "Wheat": 2688.13, "Sugarcane": 3318.03},
  {"Date": "2023-06-01", "Maize": 2133.09, "Paddy": 2339.06, "Wheat": 2573.72, "Sugarcane": 3233.92},
  {"Date": "2023-07-01", "Maize": 2075.77, "Paddy": 2205.88, "Wheat": 2506.8, "Sugarcane": 3248.16},
  {"Date": "2023-08-01", "Maize": 2000.93, "Paddy": 2326.83, "Wheat": 2537.51, "Sugarcane": 3367.14},
  {"Date": "2023-09-01", "Maize": 1936.8, "Paddy": 2286.83, "Wheat": 2494.59, "Sugarcane": 3160.48},
  {"Date": "2023-10-01", "Maize": 1973.12, "Paddy": 2230.66, "Wheat": 2467.08, "Sugarcane": 3292.01},
  {"Date": "2023-11-01", "Maize": 1937.49, "Paddy": 2355.17, "Wheat": 2638.82, "Sugarcane": 3274.14},
  {"Date": "2023-12-01", "Maize": 2122.7, "Paddy": 2151.81, "Wheat": 2730.36, "Sugarcane": 3164.73},
  {"Date": "2024-01-01", "Maize": 2046.69, "Paddy": 2249.35, "Wheat": 2720.39, "Sugarcane": 3336.3},
  {"Date": "2024-02-01", "Maize": 2196.89, "Paddy": 2334.82, "Wheat": 2594.35, "Sugarcane": 3504.58},
  {"Date": "2024-03-01", "Maize": 2159.12, "Paddy": 2462.87, "Wheat": 2528.9, "Sugarcane": 3356.04},
  {"Date": "2024-04-01", "Maize": 2086.67, "Paddy": 2282.11, "Wheat": 2667.72, "Sugarcane": 3228.68},
  {"Date": "2024-05-01", "Maize": 2236.16, "Paddy": 2486.83, "Wheat": 2806.15, "Sugarcane": 3500.74},
  {"Date": "2024-06-01", "Maize": 2039.12, "Paddy": 2446.78, "Wheat": 2792.76, "Sugarcane": 3403.49},
  {"Date": "2024-07-01", "Maize": 2001.29, "Paddy": 2306.17, "Wheat": 2845.29, "Sugarcane": 3408.19},
  {"Date": "2024-08-01", "Maize": 2091.29, "Paddy": 2273.58, "Wheat": 2779.84, "Sugarcane": 3543.48},
  {"Date": "2024-09-01", "Maize": 2231.32, "Paddy": 2310.52, "Wheat": 2539.59, "Sugarcane": 3382.31},
  {"Date": "2024-10-01", "Maize": 2249.19, "Paddy": 2213.54, "Wheat": 2700.77, "Sugarcane": 3231.06},
  {"Date": "2024-11-01", "Maize": 2247.22, "Paddy": 2466.08, "Wheat": 2622.93, "Sugarcane": 3421.98},
  {"Date": "2024-12-01", "Maize": 2035.75, "Paddy": 2221.61, "Wheat": 2559.56, "Sugarcane": 3514.77},
  {"Date": "2025-01-01", "Maize": 2243.49, "Paddy": 2572.19, "Wheat": 2932.93, "Sugarcane": 3367.92},
  {"Date": "2025-02-01", "Maize": 2293.7, "Paddy": 2349.45, "Wheat": 2681.27, "Sugarcane": 3494.22},
  {"Date": "2025-03-01", "Maize": 2234.48, "Paddy": 2304.83, "Wheat": 2928.06, "Sugarcane": 3286.86},
  {"Date": "2025-04-01", "Maize": 2319.0, "Paddy": 2393.25, "Wheat": 2875.18, "Sugarcane": 3331.23},
  {"Date": "2025-05-01", "Maize": 2211.14, "Paddy": 2309.83, "Wheat": 2702.38, "Sugarcane": 3319.9},
  {"Date": "2025-06-01", "Maize": 2301.32, "Paddy": 2378.3, "Wheat": 2761.72, "Sugarcane": 3425.04},
  {"Date": "2025-07-01", "Maize": 2175.06, "Paddy": 2313.62, "Wheat": 2767.66, "Sugarcane": 3603.45},
  {"Date": "2025-08-01", "Maize": 2202.22, "Paddy": 2520.71, "Wheat": 2874.39, "Sugarcane": 3595.43},
  {"Date": "2025-09-01", "Maize": 2199.58, "Paddy": 2366.71, "Wheat": 2759.33, "Sugarcane": 3439.59},
  {"Date": "2025-10-01", "Maize": 2227.89, "Paddy": 2550.6, "Wheat": 2769.0, "Sugarcane": 3474.19},
  {"Date": "2025-11-01", "Maize": 2202.21, "Paddy": 2444.48, "Wheat": 2651.3, "Sugarcane": 3667.48},
  {"Date": "2025-12-01", "Maize": 2271.37, "Paddy": 2450.68, "Wheat": 2680.94, "Sugarcane": 3491.51}
];

// Dataset metadata
const datasetInfo = {
  source: 'Historical Data (2021-2025)',
  records: historicalDataset.length,
  lastUpdated: '2025-12-01',
  commodities: ['Maize', 'Paddy', 'Wheat', 'Sugarcane']
};

// Base prices per quintal (in rupees) - derived from dataset average
const basePrices = {
  'Maize': 2075,
  'Paddy': 2275,
  'Wheat': 2580,
  'Sugarcane': 3300
};

// ============================================
// REAL MARKET API INTEGRATION
// ============================================

// API Configuration
const API_CONFIG = {
  // Backend API URL - Flask server
  backendUrl: 'http://localhost:5000',
  
  // API Endpoints
  endpoints: {
    livePrice: '/api/prices/live',
    allLivePrices: '/api/prices/live/all',
    compareMarkets: '/api/prices/market/compare',
    clearCache: '/api/prices/cache/clear',
    currentPrices: '/api/prices/current',
    searchPrices: '/api/prices/search',
    predictions: '/api/predictions/predict',
    auth: {
      login: '/api/auth/login',
      register: '/api/auth/register',
      adminLogin: '/api/auth/admin-login'
    }
  },
  
  // Cache settings - Increased for better performance
  useBackendCache: true,
  
  // Frontend cache duration in ms (10 minutes)
  frontendCacheDuration: 10 * 60 * 1000,
  
  // API timeout in ms (reduced from 10s to 3s for faster failure)
  apiTimeout: 3000,
  
  // Fallback to local data if backend unavailable
  useFallback: true
};

// Cache for API responses (5 minute cache)
const apiCache = new Map();
const API_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Fetch real-time price from actual backend API
async function fetchRealTimePrice(commodity, district, market) {
  const cacheKey = `api_${commodity}_${district}_${market}`;
  const cached = apiCache.get(cacheKey);
  
  if (cached && (Date.now() - cached.timestamp < API_CACHE_DURATION)) {
    return cached.data;
  }
  
  try {
    // Build the API URL with query parameters
    const url = `${API_CONFIG.backendUrl}${API_CONFIG.endpoints.livePrice}?commodity=${encodeURIComponent(commodity)}&district=${encodeURIComponent(district)}&market=${encodeURIComponent(market)}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      // Add timeout
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });
    
    if (!response.ok) {
      throw new Error(`API returned status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success) {
      const apiData = {
        price: data.price,
        min_price: data.min_price || data.price * 0.95,
        max_price: data.max_price || data.price * 1.05,
        source: data.source || 'live_api',
        commodity: commodity,
        district: district,
        market: market,
        lastUpdated: data.last_updated || new Date().toISOString(),
        isRealTime: true
      };
      
      apiCache.set(cacheKey, {
        data: apiData,
        timestamp: Date.now()
      });
      
      return apiData;
    } else {
      throw new Error(data.message || 'API returned unsuccessful response');
    }
    
  } catch (error) {
    console.log('API fetch failed, using fallback:', error.message);
    return null;
  }
}

// Fallback: Generate realistic price based on historical data when API is unavailable
async function simulateApiCall(commodity, district, market) {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Get base price from historical data
  const today = getTodayDate();
  const historicalPrice = getHistoricalPriceForDate(commodity, today);
  
  // Add realistic market variation based on current time
  const now = new Date();
  const hourVariation = Math.sin(now.getHours() * Math.PI / 12) * 2; // ±2% based on hour
  const dayVariation = Math.cos(now.getDay() * Math.PI / 3) * 1; // ±1% based on day
  
  const variation = (hourVariation + dayVariation) / 100;
  const price = Math.round(historicalPrice * (1 + variation));
  
  // Apply market-specific factors
  const marketFactor = getMarketPriceFactor(market);
  const districtFactor = getDistrictPriceFactor(district);
  const finalPrice = Math.round(price * marketFactor * districtFactor);
  
  return {
    price: finalPrice,
    min_price: Math.round(finalPrice * 0.95),
    max_price: Math.round(finalPrice * 1.05),
    source: 'historical_fallback',
    commodity: commodity,
    district: district,
    market: market,
    lastUpdated: new Date().toISOString(),
    isRealTime: false
  };
}

// Hybrid price getter - tries API first, falls back to dataset
async function getHybridPrice(commodity, district = 'Kolar', market = 'Main') {
  const today = getTodayDate();
  const storageKey = `hybrid_price_${commodity}_${district}_${market}_${today}`;
  
  // Check localStorage cache first
  let cachedData = localStorage.getItem(storageKey);
  if (cachedData) {
    const parsed = JSON.parse(cachedData);
    // If cached today and has real data, use it
    if (parsed.date === today && parsed.isHistorical === false) {
      return parsed.price;
    }
  }
  
  // Try to get real-time price from API
  let price;
  let source = 'dataset';
  let isHistorical = true;
  
  try {
    const apiData = await fetchRealTimePrice(commodity, district, market);
    if (apiData && apiData.price) {
      price = apiData.price;
      source = apiData.source || 'live_api';
      isHistorical = false;
    }
  } catch (e) {
    console.log('API unavailable, using dataset fallback');
  }
  
  // Fallback to dataset if API failed
  if (!price) {
    price = getDailyPrice(commodity, district, market);
    source = 'dataset_fallback';
  }
  
  // Cache the result
  const priceData = {
    price: price,
    date: today,
    commodity: commodity,
    district: district,
    market: market,
    source: source,
    isHistorical: isHistorical,
    lastUpdated: new Date().toISOString()
  };
  
  localStorage.setItem(storageKey, JSON.stringify(priceData));
  
  return price;
}

// Get price with full source information (for display purposes)
async function getPriceWithSource(commodity, district = 'Kolar', market = 'Main') {
  const today = getTodayDate();
  const storageKey = `price_source_${commodity}_${district}_${market}_${today}`;
  
  let cachedData = localStorage.getItem(storageKey);
  if (cachedData) {
    const parsed = JSON.parse(cachedData);
    if (parsed.date === today) {
      // Check if we should refresh (older than 5 minutes)
      const cachedTime = new Date(parsed.lastUpdated).getTime();
      const now = Date.now();
      if (now - cachedTime < API_CACHE_DURATION) {
        return parsed;
      }
    }
  }
  
  // Try API first
  let priceData = {
    price: null,
    date: today,
    commodity: commodity,
    district: district,
    market: market,
    source: 'unknown',
    isHistorical: true,
    lastUpdated: new Date().toISOString()
  };
  
  try {
    const apiData = await fetchRealTimePrice(commodity, district, market);
    if (apiData && apiData.price) {
      priceData.price = apiData.price;
      priceData.min_price = apiData.min_price;
      priceData.max_price = apiData.max_price;
      priceData.source = 'live_api';
      priceData.isHistorical = false;
    }
  } catch (e) {
    console.log('Using dataset fallback');
  }
  
  // Fallback to dataset
  if (!priceData.price) {
    priceData.price = getDailyPrice(commodity, district, market);
    priceData.min_price = Math.round(priceData.price * 0.95);
    priceData.max_price = Math.round(priceData.price * 1.05);
    priceData.source = 'historical_dataset';
  }
  
  priceData.lastUpdated = new Date().toISOString();
  localStorage.setItem(storageKey, JSON.stringify(priceData));
  return priceData;
}

// Get all current prices with API integration
async function getAllHybridPrices() {
  const districts = ['Kolar', 'Chikkabalpura', 'Bangalore Rural'];
  const prices = {};
  const sources = {};
  
  for (const commodity of Object.keys(basePrices)) {
    let total = 0;
    let count = 0;
    let source = 'dataset';
    
    for (const district of districts) {
      const market = marketsByDistrict[district][0];
      const priceInfo = await getPriceWithSource(commodity, district, market);
      total += priceInfo.price;
      count++;
      if (priceInfo.source === 'live_api') {
        source = 'live_api';
      }
    }
    
    prices[commodity] = Math.round(total / count);
    sources[commodity] = source;
  }
  
  return { prices, sources };
}

// Flag to track if dataset is loaded
let isDatasetLoaded = true;

// ============================================
// DYNAMIC PRICE SYSTEM - Daily Price Updates (Based on Real Historical Data)
// ============================================

// Get today's date as YYYY-MM-DD
function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

// Get date as YYYY-MM-DD from a Date object
function getDateString(date) {
  return date.toISOString().split('T')[0];
}

// Get daily price from historical data (interpolated for accuracy)
function getDailyHistoricalPrice(commodity, dateStr) {
  const year = parseInt(dateStr.split('-')[0]);
  const month = parseInt(dateStr.split('-')[1]);
  const day = parseInt(dateStr.split('-')[2]);
  
  // Find the two months to interpolate between
  const currentMonthStr = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextMonth = new Date(year, month, 1);
  const nextMonthStr = getDateString(nextMonth);
  
  // Get prices for current and next month
  const currentMonthData = historicalDataset.find(d => d.Date === currentMonthStr);
  const nextMonthData = historicalDataset.find(d => d.Date === nextMonthStr);
  
  // If we have data for both months, interpolate
  if (currentMonthData && nextMonthData) {
    const currentPrice = currentMonthData[commodity] || basePrices[commodity];
    const nextPrice = nextMonthData[commodity] || currentPrice;
    
    // Linear interpolation based on day of month
    const daysInMonth = new Date(year, month, 0).getDate();
    const dayProgress = (day - 1) / daysInMonth;
    
    const interpolatedPrice = currentPrice + (nextPrice - currentPrice) * dayProgress;
    return Math.round(interpolatedPrice);
  }
  
  // Fallback to available month data
  if (currentMonthData) {
    return Math.round(currentMonthData[commodity]);
  }
  
  // Fallback to base price if no historical data
  return basePrices[commodity] || 2000;
}

// Get actual historical price or interpolate for any date
function getHistoricalPriceForDate(commodity, dateStr) {
  // Check if we have exact match in historical data
  const exactMatch = historicalDataset.find(d => d.Date === dateStr);
  if (exactMatch) {
    return Math.round(exactMatch[commodity]);
  }
  
  // If no exact match, interpolate between surrounding months
  return getDailyHistoricalPrice(commodity, dateStr);
}

// Market-specific price variation factors
// These represent realistic price differences between market types
// Main Markets: Standard regulated prices (base)
// APMC Markets: +5% typically (more regulated, better prices)
// Wholesale Markets: -3% typically (bulk selling, slightly lower)
const marketTypeFactors = {
  'Main': 1.0,           // Base price - standard regulated market
  'APMC': 1.05,          // +5% - Agricultural Produce Market Committee
  'Wholesale': 0.97,     // -3% - Wholesale markets
  'default': 1.0         // Default if market type not recognized
};

// Detect market type from market name
function getMarketType(marketName) {
  if (!marketName) return 'default';
  
  const name = marketName.toLowerCase();
  
  if (name.includes('apmc')) return 'APMC';
  if (name.includes('wholesale')) return 'Wholesale';
  if (name.includes('main')) return 'Main';
  
  return 'default';
}

// Get price factor for a specific market
function getMarketPriceFactor(marketName) {
  const marketType = getMarketType(marketName);
  return marketTypeFactors[marketType] || marketTypeFactors['default'];
}

// District-specific price adjustments (regional market variations)
// Based on agricultural economics - some districts have better infrastructure
const districtPriceFactors = {
  'Kolar': 1.02,           // +2% - Good market infrastructure
  'Chikkabalpura': 0.98,   // -2% - Developing market
  'Bangalore Rural': 1.05, // +5% - Proximity to Bangalore, better prices
  'default': 1.0
};

function getDistrictPriceFactor(district) {
  return districtPriceFactors[district] || districtPriceFactors['default'];
}

// Get or create daily price for a commodity (ACCURATE - based on real historical data + market specificity)
function getDailyPrice(commodity, district = 'Kolar', market = 'Main') {
  const today = getTodayDate();
  const storageKey = `price_${commodity}_${district}_${market}_${today}`;
  
  // Try to get stored price for today
  let storedData = localStorage.getItem(storageKey);
  
  if (storedData) {
    const priceData = JSON.parse(storedData);
    // Check if stored date is today (fresh data)
    if (priceData.date === today && priceData.isHistorical) {
      return priceData.price;
    }
  }
  
  // Get ACTUAL historical price for today (or interpolated)
  const historicalPrice = getHistoricalPriceForDate(commodity, today);
  
  // Apply market-specific factor (Main, APMC, Wholesale)
  const marketFactor = getMarketPriceFactor(market);
  
  // Apply district-specific factor
  const districtFactor = getDistrictPriceFactor(district);
  
  // Combined variation based on both market type and district
  const combinedFactor = marketFactor * districtFactor;
  
  // Calculate the daily price with market specificity
  let dailyPrice = Math.round(historicalPrice * combinedFactor);
  
  // Ensure price stays within reasonable range (±15% of historical)
  // Market-specific prices can vary more legitimately
  const minPrice = Math.round(historicalPrice * 0.85);
  const maxPrice = Math.round(historicalPrice * 1.15);
  dailyPrice = Math.max(minPrice, Math.min(maxPrice, dailyPrice));
  
  // Store the price for today with historical flag and market info
  localStorage.setItem(storageKey, JSON.stringify({
    price: dailyPrice,
    date: today,
    commodity: commodity,
    district: district,
    market: market,
    basePrice: historicalPrice,
    marketFactor: marketFactor,
    districtFactor: districtFactor,
    isHistorical: true,
    variation: ((combinedFactor - 1) * 100).toFixed(2)
  }));
  
  return dailyPrice;
}

// Get price for any specific date (for predictions)
function getPriceForDate(commodity, dateStr, district = 'Kolar', market = 'Main') {
  const storageKey = `price_${commodity}_${district}_${market}_${dateStr}`;
  
  // Try to get stored price
  let storedData = localStorage.getItem(storageKey);
  
  if (storedData) {
    const priceData = JSON.parse(storedData);
    return priceData.price;
  }
  
  // Get historical price for the date
  const historicalPrice = getHistoricalPriceForDate(commodity, dateStr);
  
  // Add small variation
  const marketFactor = (district.length + market.length) % 10 - 5;
  const variationPercent = marketFactor / 100;
  let price = Math.round(historicalPrice * (1 + variationPercent));
  
  const minPrice = Math.round(historicalPrice * 0.90);
  const maxPrice = Math.round(historicalPrice * 1.10);
  price = Math.max(minPrice, Math.min(maxPrice, price));
  
  // Store
  localStorage.setItem(storageKey, JSON.stringify({
    price: price,
    date: dateStr,
    commodity: commodity,
    district: district,
    market: market,
    basePrice: historicalPrice,
    isHistorical: true,
    variation: (variationPercent * 100).toFixed(2)
  }));
  
  return price;
}

// Get current market price (for display in dashboard)
function getCurrentMarketPrice(commodity, district = 'Kolar', market = 'Main') {
  return getDailyPrice(commodity, district, market);
}

// Get all current prices for dashboard
function getAllCurrentPrices() {
  const districts = ['Kolar', 'Chikkabalpura', 'Bangalore Rural'];
  const prices = {};
  
  for (const commodity of Object.keys(basePrices)) {
    // Get average price across districts
    let total = 0;
    let count = 0;
    for (const district of districts) {
      // Get the first market from the first taluk in this district
      const districtMarkets = marketsByDistrict[district];
      const firstTaluk = Object.keys(districtMarkets)[0];
      const market = districtMarkets[firstTaluk][0];
      total += getDailyPrice(commodity, district, market);
      count++;
    }
    prices[commodity] = Math.round(total / count);
  }
  
  return prices;
}

// Get price trend for prediction (realistic market factors)
function getPriceTrend(commodity) {
  const trends = {
    'Maize': { direction: 'up', min: 3, max: 8, probability: 0.65 },      // +3-8% likely
    'Paddy': { direction: 'stable', min: -1, max: 3, probability: 0.70 }, // -1 to +3%
    'Wheat': { direction: 'up', min: 2, max: 5, probability: 0.60 },       // +2-5% likely
    'Sugarcane': { direction: 'stable', min: -2, max: 2, probability: 0.75 } // -2 to +2%
  };
  
  return trends[commodity] || { direction: 'stable', min: -2, max: 3, probability: 0.60 };
}

// Calculate predicted price based on actual historical data trends
// Enhanced to include market and district factors for accuracy
function calculatePredictedPrice(currentPrice, commodity, daysAhead = 7, district = 'Kolar', market = 'Main') {
  const today = getTodayDate();
  const [year, month, day] = today.split('-').map(Number);
  
  // Get historical price for the same period last year (for comparison)
  const lastYearDate = `${year - 1}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const lastYearPrice = getHistoricalPriceForDate(commodity, lastYearDate);
  
  // Calculate year-over-year trend
  const yoyChange = (currentPrice - lastYearPrice) / lastYearPrice;
  
  // Calculate monthly trend from historical data
  const currentMonthStr = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonthStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
  
  const currentMonthData = historicalDataset.find(d => d.Date === currentMonthStr);
  const nextMonthData = historicalDataset.find(d => d.Date === nextMonthStr);
  
  let monthlyTrend = 0;
  if (currentMonthData && nextMonthData) {
    monthlyTrend = (nextMonthData[commodity] - currentMonthData[commodity]) / currentMonthData[commodity];
  }
  
  // Calculate predicted price based on actual historical trends
  // Scale the monthly trend to the prediction period
  const daysInMonth = new Date(year, month, 0).getDate();
  const dailyTrend = monthlyTrend * (daysAhead / daysInMonth);
  
  // Add year-over-year adjustment (scaled down)
  const yoyAdjustment = yoyChange * 0.3;
  
  // Calculate final predicted price
  const predictedChange = dailyTrend + yoyAdjustment;
  let predictedPrice = Math.round(currentPrice * (1 + predictedChange));
  
  // Ensure predicted price is reasonable (±20% of current)
  const minPredicted = Math.round(currentPrice * 0.80);
  const maxPredicted = Math.round(currentPrice * 1.20);
  
  return Math.max(minPredicted, Math.min(maxPredicted, predictedPrice));
}

// Update dashboard with dynamic prices
function updateDashboardPrices() {
  const prices = getAllCurrentPrices();
  
  // Update the dashboard price display if elements exist
  const priceElements = {
    'Maize': document.querySelector('.bg-gray-50.rounded-xl:nth-child(1) .text-emerald-600'),
    'Paddy': document.querySelector('.bg-gray-50.rounded-xl:nth-child(2) .text-emerald-600'),
    'Wheat': document.querySelector('.bg-gray-50.rounded-xl:nth-child(3) .text-emerald-600'),
    'Sugarcane': document.querySelector('.bg-gray-50.rounded-xl:nth-child(4) .text-emerald-600')
  };
  


  // Find price display elements in dashboard
  const dashboardSection = document.getElementById('user-section-dashboard');
  if (dashboardSection) {
    const priceDivs = dashboardSection.querySelectorAll('.text-emerald-600.font-bold');
    if (priceDivs.length >= 4) {
      priceDivs[0].textContent = `₹${prices['Maize'].toLocaleString()}/quintal`;
      priceDivs[1].textContent = `₹${prices['Paddy'].toLocaleString()}/quintal`;
      priceDivs[2].textContent = `₹${prices['Wheat'].toLocaleString()}/quintal`;
      priceDivs[3].textContent = `₹${prices['Sugarcane'].toLocaleString()}/quintal`;
    }
  }
}

// Store prediction values with date key
let storedPredictionValues = {};
let storedSearchValues = {};

// Store current prediction data for updates
let currentPredictionData = {
  commodity: null,
  district: null,
  market: null,
  currentPrice: null,
  predictedPrice: null
};

// Element SDK Integration
async function initElementSdk() {
  if (window.elementSdk) {
    await window.elementSdk.init({
      defaultConfig,
      onConfigChange: async (config) => {
        const title = config.app_title || defaultConfig.app_title;
        const tagline = config.tagline || defaultConfig.tagline;
        
        const homeTitle = document.getElementById('home-title');
        if (homeTitle) homeTitle.textContent = title;
        
        const homeTagline = document.getElementById('home-tagline');
        if (homeTagline) homeTagline.textContent = tagline;
      },
      mapToCapabilities: (config) => ({
        recolorables: [
          {
            get: () => config.background_color || defaultConfig.background_color,
            set: (value) => {
              config.background_color = value;
              window.elementSdk.setConfig({ background_color: value });
            }
          },
          {
            get: () => config.primary_color || defaultConfig.primary_color,
            set: (value) => {
              config.primary_color = value;
              window.elementSdk.setConfig({ primary_color: value });
            }
          },
          {
            get: () => config.text_color || defaultConfig.text_color,
            set: (value) => {
              config.text_color = value;
              window.elementSdk.setConfig({ text_color: value });
            }
          }
        ],
        borderables: [],
        fontEditable: undefined,
        fontSizeable: undefined
      }),
      mapToEditPanelValues: (config) => new Map([
        ['app_title', config.app_title || defaultConfig.app_title],
        ['tagline', config.tagline || defaultConfig.tagline]
      ])
    });
  }
}

// Data SDK Integration
const dataHandler = {
  onDataChanged(data) {
    allData = data;
    rebuildUserIndex(); // Rebuild index for fast user lookups
    updateAllStats();
    updateUsersTable();
    updateActivityTimeline();
  }
};

async function initDataSdk() {
  if (window.dataSdk) {
    const result = await window.dataSdk.init(dataHandler);
    if (!result.isOk) {
      console.error('Failed to initialize Data SDK');
    }
  }
}

// Page Navigation with History Tracking
function showPage(page, addToHistory = true) {
  // Add current page to history before navigating (unless explicitly told not to)
  if (addToHistory && currentPage && page !== currentPage) {
    // Don't add duplicates - if the new page is same as last in history, don't add
    const lastPage = navigationHistory[navigationHistory.length - 1];
    if (lastPage !== page) {
      navigationHistory.push(currentPage);
    }
  }
  
  // Update current page
  const previousPage = currentPage;
  currentPage = page;
  
  // Hide all pages
  document.getElementById('home-page').classList.add('hidden');
  document.getElementById('about-us-page').classList.add('hidden');
  document.getElementById('login-page').classList.add('hidden');
  document.getElementById('register-page').classList.add('hidden');
  document.getElementById('admin-login-page').classList.add('hidden');
  document.getElementById('user-dashboard').classList.add('hidden');
  document.getElementById('admin-dashboard').classList.add('hidden');
  
  // Show requested page
  if (page === 'home') {
    document.getElementById('home-page').classList.remove('hidden');
    // Update notifications when home page is shown
    updateNotifications();
  } else if (page === 'about-us') {
    document.getElementById('about-us-page').classList.remove('hidden');
  } else if (page === 'user-login') {
    document.getElementById('login-page').classList.remove('hidden');
    // Reset the login form to ensure empty fields
    document.getElementById('login-form').reset();
  } else if (page === 'user-register') {
    document.getElementById('register-page').classList.remove('hidden');
    // Reset the register form to ensure empty fields
    document.getElementById('register-form').reset();
  } else if (page === 'user-admin-login') {
    document.getElementById('admin-login-page').classList.remove('hidden');
    // Reset the admin login form to ensure empty fields (only if remember me is NOT checked)
    if (!localStorage.getItem('adminRememberMe') || localStorage.getItem('adminRememberMe') !== 'true') {
      document.getElementById('admin-login-form').reset();
    }
    // Load saved admin credentials if remember me was checked
    loadAdminCredentials();
  } else if (page === 'user-dashboard') {
    document.getElementById('user-dashboard').classList.remove('hidden');
    // Update markets count when user dashboard is loaded
    updateMarketsAvailableCount();
  } else if (page === 'admin-dashboard') {
    document.getElementById('admin-dashboard').classList.remove('hidden');
    // Initialize admin data on first load
    updateAllStats();
    updateUsersTable();
    updateActivityTimeline();
    setTimeout(() => initAdminCharts(), 100);
  }
}

// Go back to previously visited page
function goBack() {
  if (navigationHistory.length > 0) {
    // Pop the last page from history and navigate to it (without adding to history again)
    const previousPage = navigationHistory.pop();
    showPage(previousPage, false); // false = don't add current page to history again
  } else {
    // No history, go to home
    showPage('home', false);
  }
}

// User Section Navigation
function showUserSection(section) {
  const sections = ['dashboard', 'market-search', 'prediction', 'profile', 'settings'];
  sections.forEach(s => {
    const el = document.getElementById(`user-section-${s}`);
    if (el) el.classList.add('hidden');
    
    const navItem = document.querySelector(`.user-nav-item[data-section="${s}"]`);
    if (navItem) navItem.classList.remove('bg-emerald-600');
  });
  
  const targetSection = document.getElementById(`user-section-${section}`);
  if (targetSection) targetSection.classList.remove('hidden');
  
  const activeNav = document.querySelector(`.user-nav-item[data-section="${section}"]`);
  if (activeNav) activeNav.classList.add('bg-emerald-600');
  
  // Update dashboard prices and markets count when dashboard is shown
  if (section === 'dashboard') {
    // Update prices from the historical dataset
    updateDashboardPrices();
    // Update markets count
    updateMarketsAvailableCount();
  }
  
  // Load user complaints when market-search is shown
  if (section === 'market-search') {
    loadUserComplaints();
  }
}

// Admin Section Navigation
function showAdminSection(section) {
  const sections = ['dashboard', 'control', 'data', 'activity', 'users', 'profile'];
  sections.forEach(s => {
    const el = document.getElementById(`admin-section-${s}`);
    if (el) el.classList.add('hidden');
    
    const navItem = document.querySelector(`.admin-nav-item[data-section="${s}"]`);
    if (navItem) navItem.classList.remove('bg-emerald-600');
  });
  
  const targetSection = document.getElementById(`admin-section-${section}`);
  if (targetSection) targetSection.classList.remove('hidden');
  
  const activeNav = document.querySelector(`.admin-nav-item[data-section="${section}"]`);
  if (activeNav) activeNav.classList.add('bg-emerald-600');

  // Update admin data when navigating to relevant sections
  if (section === 'dashboard') {
    updateAllStats();
    initAdminCharts();
  } else if (section === 'control') {
    // Populate the markets card dynamically when control center is loaded
    populateMarketsCard();
    // Load remarks when control center is displayed
    loadRemarks();
    // Load complaints in admin Market Center
    loadAdminComplaints();
  } else if (section === 'data') {
    updateAllStats();
    loadAdminMarkets();
    loadPriceRecords();
    setTimeout(() => initDataChart(), 100);
  } else if (section === 'activity') {
    updateAllStats();
    updateActivityTimeline();
  } else if (section === 'users') {
    updateAllStats();
    updateUsersTable();
  }
}

// Data Management Tab Navigation
function showDataTab(tab) {
  const tabs = ['import', 'markets', 'records'];
  
  // Update tab button styles
  tabs.forEach(t => {
    const btn = document.getElementById(`data-tab-${t}`);
    if (btn) {
      if (t === tab) {
        btn.className = 'px-4 py-2 bg-white text-teal-700 rounded-xl font-semibold';
      } else {
        btn.className = 'px-4 py-2 bg-white bg-opacity-20 text-white rounded-xl font-semibold hover:bg-opacity-30';
      }
    }
    
    const content = document.getElementById(`data-content-${t}`);
    if (content) {
      if (t === tab) {
        content.classList.remove('hidden');
      } else {
        content.classList.add('hidden');
      }
    }
  });
  
  // Load data for the selected tab
  if (tab === 'markets') {
    loadAdminMarkets();
  } else if (tab === 'records') {
    loadPriceRecords();
  } else if (tab === 'import') {
    updateAllStats();
    setTimeout(() => initDataChart(), 100);
  }
}

// Load Markets for Admin Data Management
function loadAdminMarkets() {
  const tbody = document.getElementById('markets-table-body');
  if (!tbody) return;
  
  // Try to fetch markets from the backend API first
  fetch(`${API_CONFIG.backendUrl}/api/admin/markets`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    }
  })
  .then(response => response.json())
  .then(data => {
    if (data.success && data.markets && data.markets.length > 0) {
      // Render markets from database - pass both ID and market name for API calls
      tbody.innerHTML = data.markets.map((market, index) => `
        <tr class="border-t border-gray-200 hover:bg-gray-50">
          <td class="px-4 py-3 text-sm text-gray-600">${index + 1}</td>
          <td class="px-4 py-3 text-sm font-medium text-gray-800">${market.district || ''}</td>
          <td class="px-4 py-3 text-sm text-gray-800">${market.market || ''}</td>
          <td class="px-4 py-3 text-sm text-gray-600">${market.record_count || 0}</td>
          <td class="px-4 py-3 text-sm text-gray-600">₹${Math.round(market.avg_price || 0).toLocaleString()}/quintal</td>
          <td class="px-4 py-3">
            <button onclick="editMarket('${market.id}', '${market.market}', '${market.district}')" class="text-blue-600 hover:text-blue-800 text-sm font-medium mr-2">Edit</button>
            <button onclick="deleteMarket('${market.id}', '${market.market}')" class="text-red-600 hover:text-red-800 text-sm font-medium">Delete</button>
          </td>
        </tr>
      `).join('');
    } else {
      // Fallback to static data if no markets in database
      loadAdminMarketsStatic();
    }
  })
  .catch(error => {
    console.log('Error fetching markets from API, using static data:', error);
    loadAdminMarketsStatic();
  });
}

// Fallback function to load markets from static data
function loadAdminMarketsStatic() {
  const tbody = document.getElementById('markets-table-body');
  if (!tbody) return;
  
  // Get all markets from the marketsByDistrict data
  const allMarkets = [];
  
  for (const district in marketsByDistrict) {
    const taluks = marketsByDistrict[district];
    for (const taluk in taluks) {
      const markets = taluks[taluk];
      markets.forEach((market, idx) => {
        // Calculate average price for this market
        let totalPrice = 0;
        let count = 0;
        for (const commodity of Object.keys(basePrices)) {
          totalPrice += getDailyPrice(commodity, district, market);
          count++;
        }
        const avgPrice = count > 0 ? Math.round(totalPrice / count) : 0;
        
        // Estimate records (random for demo)
        const records = Math.floor(Math.random() * 500) + 100;
        
        // Create a unique ID based on index
        const marketId = idx + 1;
        
        allMarkets.push({
          id: marketId,
          name: market,
          district: district,
          taluk: taluk,
          records: records,
          avgPrice: avgPrice
        });
      });
    }
  }
  
  if (allMarkets.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-8 text-center text-gray-500">No markets found</td></tr>';
    return;
  }
  
  tbody.innerHTML = allMarkets.map((market, index) => `
    <tr class="border-t border-gray-200 hover:bg-gray-50">
      <td class="px-4 py-3 text-sm text-gray-600">${index + 1}</td>
      <td class="px-4 py-3 text-sm font-medium text-gray-800">${market.district}</td>
      <td class="px-4 py-3 text-sm text-gray-800">${market.name}</td>
      <td class="px-4 py-3 text-sm text-gray-600">${market.records}</td>
      <td class="px-4 py-3 text-sm text-gray-600">₹${market.avgPrice.toLocaleString()}/quintal</td>
      <td class="px-4 py-3">
        <button onclick="editMarket('${market.id}', '${market.name}', '${market.district}')" class="text-blue-600 hover:text-blue-800 text-sm font-medium mr-2">Edit</button>
        <button onclick="deleteMarket('${market.id}', '${market.name}')" class="text-red-600 hover:text-red-800 text-sm font-medium">Delete</button>
      </td>
    </tr>
  `).join('');
}

// Load Price Records for Admin Data Management
let currentRecordsPage = 1;
const recordsPerPage = 10;

function loadPriceRecords() {
  const tbody = document.getElementById('price-records-table-body');
  if (!tbody) return;
  
  // Get filter values
  const commodityFilter = document.getElementById('record-filter-commodity')?.value || '';
  const districtFilter = document.getElementById('record-filter-district')?.value || '';
  
  // Generate sample records from historical data
  const records = [];
  const commodities = ['Maize', 'Paddy', 'Wheat', 'Sugarcane'];
  const districts = ['Kolar', 'Chikkabalpura', 'Bangalore Rural'];
  
  // Create sample records based on historical dataset
  historicalDataset.forEach((data, index) => {
    commodities.forEach(commodity => {
      if (!commodityFilter || commodity === commodityFilter) {
        districts.forEach(district => {
          if (!districtFilter || district === districtFilter) {
            const market = getAllMarketsByDistrict(district)[0] || 'Main Market';
            records.push({
              id: index * 10 + commodities.indexOf(commodity),
              date: data.Date,
              commodity: commodity,
              price: Math.round(data[commodity]),
              district: district,
              market: market
            });
          }
        });
      }
    });
  });
  
  // Sort by date descending
  records.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  // Paginate
  const totalPages = Math.ceil(records.length / recordsPerPage);
  const startIndex = (currentRecordsPage - 1) * recordsPerPage;
  const paginatedRecords = records.slice(startIndex, startIndex + recordsPerPage);
  
  if (paginatedRecords.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="px-4 py-8 text-center text-gray-500">No records found</td></tr>';
  } else {
    tbody.innerHTML = paginatedRecords.map(record => `
      <tr class="border-t border-gray-200 hover:bg-gray-50">
        <td class="px-4 py-3 text-sm text-gray-600">${record.id}</td>
        <td class="px-4 py-3 text-sm text-gray-600">${record.date}</td>
        <td class="px-4 py-3 text-sm font-medium text-gray-800">${record.commodity}</td>
        <td class="px-4 py-3 text-sm text-gray-800">₹${record.price.toLocaleString()}/quintal</td>
        <td class="px-4 py-3 text-sm text-gray-600">${record.district}</td>
        <td class="px-4 py-3 text-sm text-gray-600">${record.market}</td>
        <td class="px-4 py-3">
          <button onclick="viewRecord('${record.id}')" class="text-blue-600 hover:text-blue-800 text-sm font-medium">View</button>
        </td>
      </tr>
    `).join('');
  }
  
  // Update pagination info
  const paginationInfo = document.getElementById('records-pagination-info');
  if (paginationInfo) {
    const showing = paginatedRecords.length > 0 ? startIndex + 1 : 0;
    const to = Math.min(startIndex + recordsPerPage, records.length);
    paginationInfo.textContent = `Showing ${showing}-${to} of ${records.length} records`;
  }
}

function changeRecordsPage(direction) {
  currentRecordsPage += direction;
  if (currentRecordsPage < 1) currentRecordsPage = 1;
  loadPriceRecords();
}

// Edit Market function
function editMarket(marketId, marketName, district) {
  // Show edit modal with current values
  showModal(`
    <h3 class="text-xl font-bold text-gray-800 mb-4">Edit Market</h3>
    <form onsubmit="saveMarketEdit(event, '${marketId}')">
      <div class="mb-4">
        <label class="block text-gray-700 font-medium mb-2">Market Name</label>
        <input type="text" id="edit-market-name" value="${marketName || ''}" required class="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500" placeholder="Enter market name">
      </div>
      <div class="mb-4">
        <label class="block text-gray-700 font-medium mb-2">District</label>
        <select id="edit-market-district" required class="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500">
          <option value="Kolar" ${district === 'Kolar' ? 'selected' : ''}>Kolar</option>
          <option value="Chikkabalpura" ${district === 'Chikkabalpura' ? 'selected' : ''}>Chikkabalpura</option>
          <option value="Bangalore Rural" ${district === 'Bangalore Rural' ? 'selected' : ''}>Bangalore Rural</option>
        </select>
      </div>
      <div class="flex gap-3">
        <button type="button" onclick="hideModal()" class="flex-1 py-3 border-2 border-gray-300 text-gray-600 rounded-xl font-bold hover:bg-gray-50">Cancel</button>
        <button type="submit" class="flex-1 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700">Save Changes</button>
      </div>
    </form>
  `);
}

// Save market edit
function saveMarketEdit(e, marketId) {
  e.preventDefault();
  const newMarketName = document.getElementById('edit-market-name').value;
  const newDistrict = document.getElementById('edit-market-district').value;
  
  if (!newMarketName || !newDistrict) {
    showToast('Please fill in all required fields', '⚠️');
    return;
  }
  
  // Call the backend API to update the market
  fetch(`${API_CONFIG.backendUrl}/api/admin/markets/${marketId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      market: newMarketName,
      district: newDistrict
    })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      showToast(`Market "${newMarketName}" updated successfully!`, '✅');
      hideModal();
      loadAdminMarkets(); // Reload markets from the database
    } else {
      showToast(data.message || 'Failed to update market', '❌');
    }
  })
  .catch(error => {
    console.error('Error updating market:', error);
    showToast('Error updating market. Please try again.', '❌');
  });
}

// Delete Market function
function deleteMarket(marketId, marketName) {
  if (confirm(`Are you sure you want to delete "${marketName}"? This will also delete all price records associated with this market.`)) {
    // Call the backend API to delete the market
    fetch(`${API_CONFIG.backendUrl}/api/admin/markets/${marketId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      }
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        showToast(`Market "${marketName}" deleted successfully!`, '🗑️');
        loadAdminMarkets(); // Reload markets from the database
      } else {
        showToast(data.message || 'Failed to delete market', '❌');
      }
    })
    .catch(error => {
      console.error('Error deleting market:', error);
      showToast('Error deleting market. Please try again.', '❌');
    });
  }
}

// View Record function
function viewRecord(recordId) {
  showToast(`Viewing record ID: ${recordId}`, '👁️');
}

// Add Market Modal Function
function showAddMarketModal() {
  showModal(`
    <h3 class="text-xl font-bold text-gray-800 mb-4">Add New Market</h3>
    <form onsubmit="addMarket(event)">
      <div class="mb-4">
        <label class="block text-gray-700 font-medium mb-2">District</label>
        <select id="add-market-district" required class="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500">
          <option value="">Select District</option>
          <option value="Kolar">Kolar</option>
          <option value="Chikkabalpura">Chikkabalpura</option>
          <option value="Bangalore Rural">Bangalore Rural</option>
        </select>
      </div>
      <div class="mb-4">
        <label class="block text-gray-700 font-medium mb-2">Market Name</label>
        <input type="text" id="add-market-name" required class="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500" placeholder="Enter market name">
      </div>
      <div class="mb-6">
        <label class="block text-gray-700 font-medium mb-2">Taluk</label>
        <input type="text" id="add-market-taluk" required class="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500" placeholder="Enter taluk name">
      </div>
      <div class="flex gap-3">
        <button type="button" onclick="hideModal()" class="flex-1 py-3 border-2 border-gray-300 text-gray-600 rounded-xl font-bold hover:bg-gray-50">Cancel</button>
        <button type="submit" class="flex-1 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700">Add Market</button>
      </div>
    </form>
  `);
}

function addMarket(e) {
  e.preventDefault();
  const district = document.getElementById('add-market-district').value;
  const marketName = document.getElementById('add-market-name').value;
  const taluk = document.getElementById('add-market-taluk').value;
  
  // Get commodity and price values (or use defaults)
  const commodity = document.getElementById('add-market-commodity')?.value || 'Maize';
  const price = parseFloat(document.getElementById('add-market-price')?.value) || 2000;
  
  if (!district || !marketName) {
    showToast('Please fill in all required fields', '⚠️');
    return;
  }
  
  // Call the backend API to add the market
  fetch(`${API_CONFIG.backendUrl}/api/admin/markets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      district: district,
      market: marketName,
      commodity: commodity,
      price: price
    })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      showToast(`Market "${marketName}" added successfully!`, '✅');
      hideModal();
      loadAdminMarkets(); // Reload markets from the database
    } else {
      showToast(data.message || 'Failed to add market', '❌');
    }
  })
  .catch(error => {
    console.error('Error adding market:', error);
    showToast('Error adding market. Please try again.', '❌');
  });
}

// Dataset Import Modal
function showDatasetImportModal() {
  showModal(`
    <h3 class="text-xl font-bold text-gray-800 mb-4">Import Dataset</h3>
    <form onsubmit="importDataset(event)">
      <div class="mb-4">
        <label class="block text-gray-700 font-medium mb-2">Select File</label>
        <input type="file" id="import-file" accept=".csv,.json,.xlsx" required class="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-teal-500">
        <p class="text-xs text-gray-500 mt-1">Supported formats: CSV, JSON, Excel</p>
      </div>
      <div class="mb-4">
        <label class="block text-gray-700 font-medium mb-2">Data Type</label>
        <select id="import-type" class="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-teal-500">
          <option value="prices">Price Data</option>
          <option value="markets">Market Data</option>
          <option value="both">Both</option>
        </select>
      </div>
      <div id="import-progress" class="hidden mb-4">
        <div class="w-full bg-gray-200 rounded-full h-2">
          <div id="import-progress-bar" class="bg-teal-600 h-2 rounded-full" style="width: 0%"></div>
        </div>
        <p id="import-status" class="text-sm text-gray-600 mt-1">Importing...</p>
      </div>
      <div class="flex gap-3">
        <button type="button" onclick="hideModal()" class="flex-1 py-3 border-2 border-gray-300 text-gray-600 rounded-xl font-bold hover:bg-gray-50">Cancel</button>
        <button type="submit" id="import-btn" class="flex-1 py-3 bg-teal-600 text-white rounded-xl font-bold hover:bg-teal-700">Import</button>
      </div>
    </form>
  `);
}

function importDataset(e) {
  e.preventDefault();
  const progress = document.getElementById('import-progress');
  const progressBar = document.getElementById('import-progress-bar');
  const status = document.getElementById('import-status');
  const importBtn = document.getElementById('import-btn');
  
  progress.classList.remove('hidden');
  importBtn.disabled = true;
  
  // Simulate import progress
  let width = 0;
  const interval = setInterval(() => {
    width += 10;
    progressBar.style.width = width + '%';
    
    if (width >= 100) {
      clearInterval(interval);
      status.textContent = 'Import completed!';
      
      setTimeout(() => {
        hideModal();
        showToast('Dataset imported successfully!', '✅');
        updateAllStats();
        setTimeout(() => initDataChart(), 100);
      }, 500);
    } else {
      status.textContent = `Importing... ${width}%`;
    }
  }, 200);
}

// Authentication Handlers
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  
  const btn = document.getElementById('login-btn');
  btn.textContent = 'Signing in...';
  btn.disabled = true;

  // Fast O(1) lookup using index instead of linear search
  const existingUser = userIndexByEmail.get(email.toLowerCase());
  
  if (existingUser && existingUser.password === password) {
    currentUser = existingUser;
    isAdmin = false;
    updateUserProfile();
    
    // Fire and forget - don't await to speed up login
    logActivity('login', `User ${email} logged in`).catch(() => {});
    
    showToast('Login successful!', '✅');
    showPage('user-dashboard');
    showUserSection('dashboard');
  } else if (existingUser) {
    showToast('Invalid password', '❌');
  } else {
    showToast('User not found. Please register.', '❌');
  }

  btn.textContent = 'Sign In';
  btn.disabled = false;
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('reg-name').value;
  const email = document.getElementById('reg-email').value;
  const phone = document.getElementById('reg-phone').value;
  const password = document.getElementById('reg-password').value;
  const confirm = document.getElementById('reg-confirm').value;
  const errorEl = document.getElementById('reg-error');

  // Validate mobile number - must be exactly 10 digits
  const phoneDigits = phone.replace(/\D/g, ''); // Remove any non-digit characters
  if (phoneDigits.length !== 10) {
    errorEl.textContent = 'Mobile number must be exactly 10 digits';
    errorEl.classList.remove('hidden');
    return;
  }

  if (password !== confirm) {
    errorEl.textContent = 'Passwords do not match';
    errorEl.classList.remove('hidden');
    return;
  }

  // Fast O(1) lookup using index instead of linear search
  const existingUser = userIndexByEmail.get(email.toLowerCase());
  if (existingUser) {
    errorEl.textContent = 'Email already registered';
    errorEl.classList.remove('hidden');
    return;
  }

  if (allData.length >= 999) {
    errorEl.textContent = 'Maximum users reached. Please contact admin.';
    errorEl.classList.remove('hidden');
    return;
  }

  // Create user data object with temporary ID
  const tempId = Date.now();
  const newUser = {
    type: 'user',
    username: name,
    email: email,
    phone: phone,
    password: password,
    role: 'user',
    status: 'active',
    created_at: new Date().toISOString(),
    __backendId: tempId
  };

  // Immediately update local cache for instant registration experience
  allData.push(newUser);
  
  // Update the user index immediately for fast lookups
  userIndexByEmail.set(email.toLowerCase(), newUser);

  // Reset form and hide error
  document.getElementById('register-form').reset();
  document.getElementById('reg-error').classList.add('hidden');

  // Show success immediately - don't wait for backend
  showToast('Registration successful! Please login.', '✅');

  // Navigate to login page immediately for fast UX
  showPage('user-login');

  // Fire and forget - sync with backend in background (non-blocking)
  if (window.dataSdk) {
    window.dataSdk.create(newUser).then(result => {
      // Update the temp ID with actual backend ID if needed
      const userIndex = allData.findIndex(d => d.__backendId === tempId);
      if (userIndex !== -1 && result.id) {
        allData[userIndex].__backendId = result.id;
      }
    }).catch(err => {
      console.log('Background sync ongoing');
    });
  }
}

async function handleAdminLogin(e) {
  e.preventDefault();
  const email = document.getElementById('admin-email').value;
  const password = document.getElementById('admin-password').value;
  const secret = document.getElementById('admin-secret').value;
  const rememberMe = document.getElementById('admin-remember')?.checked || false;
  const errorEl = document.getElementById('admin-error');

  // Demo admin credentials (in production, this would be server-side)
  const ADMIN_SECRET = 'AGRI2026';

  // Validate email is @gmail.com
  if (!email.toLowerCase().endsWith('@gmail.com')) {
    errorEl.textContent = 'Please use a valid @gmail.com email address';
    errorEl.classList.remove('hidden');
    return;
  }

  if (secret !== ADMIN_SECRET) {
    errorEl.textContent = 'Invalid secret key';
    errorEl.classList.remove('hidden');
    return;
  }
  const btn = document.getElementById('admin-login-btn');
  btn.textContent = 'Verifying...';
  btn.disabled = true;

  // Default admin credentials (email must end with @gmail.com)
  const defaultAdminEmail = 'admin@gmail.com';
  const defaultAdminPassword = 'admin123';
  
  // Fast path: Check default admin credentials first without async operations
  if (email === defaultAdminEmail && password === defaultAdminPassword) {
    // Save credentials if remember me is checked
    saveAdminCredentials(email, password, secret, rememberMe);
    
    currentUser = { username: 'Admin', email: defaultAdminEmail, phone: '9999999999', role: 'admin' };
    isAdmin = true;
    updateAdminProfile();
    
    // Fire and forget - don't await to speed up login
    logActivity('admin_login', `Admin ${email} logged in`).catch(() => {});
    
    showToast('Admin login successful!', '🛡️');
    showPage('admin-dashboard');
    showAdminSection('dashboard');
    
    btn.textContent = 'Access Admin Panel';
    btn.disabled = false;
    return;
  }

  // Check for existing admin user in data
  const adminUser = allData.find(d => d.type === 'user' && d.role === 'admin' && d.email === email);

  if (adminUser && adminUser.password === password) {
    // Save credentials if remember me is checked
    saveAdminCredentials(email, password, secret, rememberMe);
    
    currentUser = adminUser;
    isAdmin = true;
    updateAdminProfile();
    
    // Fire and forget - don't login
    logActivity('admin_login await to speed up', `Admin ${email} logged in`).catch(() => {});
    
    showToast('Admin login successful!', '🛡️');
    showPage('admin-dashboard');
    showAdminSection('dashboard');
  } else if (adminUser) {
    errorEl.textContent = 'Invalid password';
    errorEl.classList.remove('hidden');
    btn.textContent = 'Access Admin Panel';
    btn.disabled = false;
    return;
  } else {
    errorEl.textContent = 'Invalid admin credentials';
    errorEl.classList.remove('hidden');
  }

  btn.textContent = 'Access Admin Panel';
  btn.disabled = false;
}

function handleLogout() {
  // Clear admin credentials from localStorage on logout
  localStorage.removeItem(ADMIN_REMEMBER_KEY);
  localStorage.removeItem(ADMIN_CREDENTIALS_KEY);
  
  currentUser = null;
  isAdmin = false;
  showToast('Logged out successfully', '👋');
  showPage('home');
}

// Contact Form Handler
function handleContactSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('contact-name').value;
  const email = document.getElementById('contact-email').value;
  const message = document.getElementById('contact-message').value;
  
  if (!name || !email || !message) {
    showToast('Please fill in all fields', '⚠️');
    return;
  }
  
  // Simulate form submission (in production, this would call a backend API)
  // Store contact message in localStorage for demo purposes
  const contactData = {
    type: 'contact',
    name: name,
    email: email,
    message: message,
    created_at: new Date().toISOString()
  };
  
  // Get existing contacts or initialize empty array
  const contacts = JSON.parse(localStorage.getItem('contact_messages') || '[]');
  contacts.unshift(contactData);
  localStorage.setItem('contact_messages', JSON.stringify(contacts));
  
  // Show success message
  showToast('Thank you! Your message has been sent. We will get back to you soon.', '✅');
  
  // Reset the form
  document.getElementById('contact-form').reset();
}

// Market Functions
function updateMarkets() {
  const district = document.getElementById('search-district').value;
  const marketSelect = document.getElementById('search-market');
  
  if (!marketSelect) {
    console.error('Market select element not found');
    return;
  }
  
  marketSelect.innerHTML = '<option value="">Select Market</option>';
  
  if (district && marketsByDistrict[district]) {
    // Get all markets from all taluks within the district
    const allMarkets = getAllMarketsByDistrict(district);
    
    if (allMarkets.length > 0) {
      allMarkets.forEach(market => {
        marketSelect.innerHTML += `<option value="${market}">${market}</option>`;
      });
    } else {
      // Fallback: Add default markets if no markets found
      const districtMarkets = ['Main Market', 'APMC', 'Wholesale'];
      districtMarkets.forEach(market => {
        marketSelect.innerHTML += `<option value="${market}">${market}</option>`;
      });
    }
  } else {
    // If district not found in marketsByDistrict, add fallback options
    const fallbackMarkets = ['Main Market', 'APMC', 'Wholesale'];
    fallbackMarkets.forEach(market => {
      marketSelect.innerHTML += `<option value="${market}">${market}</option>`;
    });
  }
  
  // Also update price preview when markets change
  updateMarketPrice();
}

// Function to update and display price when market is selected
async function updateMarketPrice() {
  const commodity = document.getElementById('search-commodity').value;
  const district = document.getElementById('search-district').value;
  const market = document.getElementById('search-market').value;
  
  // Get or create the price preview element
  let pricePreview = document.getElementById('market-price-preview');
  
  // Only show price if all required fields are selected
  if (!commodity || !district || !market) {
    if (pricePreview) {
      pricePreview.classList.add('hidden');
    }
    return;
  }
  
  // Try to get real-time price from API first
  const priceInfo = await getPriceWithSource(commodity, district, market);
  const currentPrice = priceInfo.price;
  
  // Get market type for display
  const marketType = getMarketType(market);
  const marketFactor = getMarketPriceFactor(market);
  const districtFactor = getDistrictPriceFactor(district);
  
  // Calculate the percentage variation from base price
  const variationPercent = ((marketFactor * districtFactor - 1) * 100).toFixed(1);
  const isPositive = variationPercent >= 0;
  
  // Determine source label
  const isLive = priceInfo.source === 'live_api';
  const sourceLabel = isLive ? '🔴 Live' : '📊 Historical';
  const sourceClass = isLive ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700';
  
  // Create or update the price preview element
  if (!pricePreview) {
    // Find the form and add the preview after it
    const form = document.getElementById('market-search-form');
    const formContainer = form.parentElement;
    
    pricePreview = document.createElement('div');
    pricePreview.id = 'market-price-preview';
    pricePreview.className = 'bg-white rounded-2xl p-4 shadow-lg mb-6';
    formContainer.appendChild(pricePreview);
  }
  
  // Get commodity icon
  const commodityIcons = {
    'Maize': '🌽',
    'Paddy': '🌾',
    'Wheat': '🌿',
    'Sugarcane': '🎋'
  };
  
  const icon = commodityIcons[commodity] || '📦';
  
  // Build the price preview HTML with live indicator
  pricePreview.innerHTML = `
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-4">
        <div class="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-2xl">${icon}</div>
        <div>
          <div class="flex items-center gap-2">
            <p class="text-gray-500 text-sm">Current Price</p>
            <span class="text-xs px-2 py-0.5 rounded-full ${sourceClass}">${sourceLabel}</span>
          </div>
          <p class="text-2xl font-bold text-gray-800">₹${currentPrice.toLocaleString()}/quintal</p>
        </div>
      </div>
      <div class="text-right">
        <p class="text-gray-500 text-sm">Market: ${market}</p>
        <p class="text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}">
          ${isPositive ? '↑' : '↓'} ${Math.abs(variationPercent)}% ${isPositive ? 'above' : 'below'} base price
        </p>
        <p class="text-xs text-gray-400">${marketType} • ${district}</p>
      </div>
    </div>
  `;
  
  pricePreview.classList.remove('hidden');
}

function updatePredMarkets() {
  const district = document.getElementById('pred-district').value;
  const marketSelect = document.getElementById('pred-market');
  marketSelect.innerHTML = '<option value="">Select Market</option>';
  
  if (district && marketsByDistrict[district]) {
    // Get all markets from all taluks within the district
    const allMarkets = getAllMarketsByDistrict(district);
    allMarkets.forEach(market => {
      marketSelect.innerHTML += `<option value="${market}">${market}</option>`;
    });
  }
}

async function handleMarketSearch(e) {
  e.preventDefault();
  const commodity = document.getElementById('search-commodity').value;
  const district = document.getElementById('search-district').value;
  const market = document.getElementById('search-market').value;
  const quantity = document.getElementById('search-quantity').value;

  await logActivity('market_search', `Searched ${commodity} in ${market}, ${district}`);

  // Use hybrid price system (tries API first, falls back to dataset)
  const priceInfo = await getPriceWithSource(commodity, district, market);
  const currentPrice = priceInfo.price;
  const totalValue = currentPrice * quantity;

  const resultsDiv = document.getElementById('price-results');
  resultsDiv.innerHTML = `
    <div class="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border-l-4 border-emerald-500">
      <div class="flex items-center justify-between">
        <p class="font-semibold text-emerald-800">${commodity}</p>
        <span class="text-xs px-2 py-1 rounded-full ${priceInfo.source === 'real_time_api' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}">
          ${priceInfo.source === 'real_time_api' ? '🔴 Live' : '📊 Dataset'}
        </span>
      </div>
      <p class="text-2xl font-bold text-gray-800 mt-1">₹${currentPrice.toLocaleString()}/quintal</p>
    </div>
    <div class="p-4 bg-gray-50 rounded-xl">
      <div class="flex justify-between">
        <span class="text-gray-600">Market:</span>
        <span class="font-medium">${market}</span>
      </div>
    </div>
    <div class="p-4 bg-gray-50 rounded-xl">
      <div class="flex justify-between">
        <span class="text-gray-600">District:</span>
        <span class="font-medium">${district}</span>
      </div>
    </div>
    <div class="p-4 bg-gray-50 rounded-xl">
      <div class="flex justify-between">
        <span class="text-gray-600">Quantity:</span>
        <span class="font-medium">${quantity} quintals</span>
      </div>
    </div>
    <div class="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border-l-4 border-blue-500">
      <p class="text-gray-600">Total Value</p>
      <p class="text-2xl font-bold text-blue-800">₹${totalValue.toLocaleString()}</p>
    </div>
  `;

  document.getElementById('search-results').classList.remove('hidden');
  initSearchChart(commodity, currentPrice);
  updateUserStats();
}

async function handlePrediction(e) {
  e.preventDefault();
  const commodity = document.getElementById('pred-commodity').value;
  const district = document.getElementById('pred-district').value;
  const market = document.getElementById('pred-market').value;
  const quantity = document.getElementById('pred-quantity').value;
  const quantile = parseFloat(document.getElementById('pred-quantile').value) || 0.50;

  // Get current date to make prices dynamic (changes daily)
  const today = getTodayDate();
  
  // Create unique key for this prediction combination (include quantile for cache)
  const predictionKey = `${commodity}_${district}_${market}_${quantile}_${today}`;
  
  // Check if prediction already exists for this combination today
  let currentPrice, predictedPrice, priceSource;
  
  if (storedPredictionValues[predictionKey]) {
    // Use existing stored values for today
    currentPrice = storedPredictionValues[predictionKey].currentPrice;
    predictedPrice = storedPredictionValues[predictionKey].predictedPrice;
    priceSource = storedPredictionValues[predictionKey].priceSource || 'historical_dataset';
  } else {
    // Generate new values - Try to get real-time price from backend API first
    await logActivity('prediction', `Predicted ${commodity} prices for ${market}, ${district}`);

    // Try to fetch real-time price from backend API
    let priceData = null;
    try {
      const apiUrl = `${API_CONFIG.backendUrl}/api/prices/live?commodity=${encodeURIComponent(commodity)}&district=${encodeURIComponent(district)}&market=${encodeURIComponent(market)}`;
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.price) {
          priceData = data;
        }
      }
    } catch (error) {
      console.log('API fetch failed, using fallback:', error.message);
    }

    if (priceData && priceData.price) {
      // Use real-time price from API
      currentPrice = priceData.price;
      priceSource = priceData.source || 'live_api';
    } else {
      // Fallback to dynamic price calculation from historical data
      currentPrice = getDailyPrice(commodity, district, market);
      priceSource = 'historical_dataset';
    }
    
    // Calculate predicted price based on current price using realistic market trends
    const basePredictedPrice = calculatePredictedPrice(currentPrice, commodity, 7, district, market);
    // Apply quantile adjustment
    predictedPrice = calculateQuantilePrice(basePredictedPrice, quantile, commodity);

    // Store the prediction values with date key for daily dynamic prices
    storedPredictionValues[predictionKey] = {
      currentPrice,
      predictedPrice,
      commodity,
      date: today,
      priceSource: priceSource,
      quantile: quantile
    };
    
    // Update user stats only on first prediction
    updateUserStats();
  }

  // Store current prediction data for dynamic updates
  currentPredictionData = {
    commodity: commodity,
    district: district,
    market: market,
    currentPrice: currentPrice,
    predictedPrice: predictedPrice,
    quantity: parseInt(quantity),
    priceSource: priceSource,
    quantile: quantile
  };

  // Calculate total values
  const currentTotal = currentPrice * parseInt(quantity);
  const predictedTotal = predictedPrice * parseInt(quantity);

  // Update DOM with current prices (per quintal)
  document.getElementById('current-price').textContent = `₹${currentPrice.toLocaleString()}`;
  document.getElementById('predicted-price').textContent = `₹${predictedPrice.toLocaleString()}`;

  // Show total values with price source indicator
  const currentPriceTotal = document.getElementById('current-price-total');
  const predictedPriceTotal = document.getElementById('predicted-price-total');
  if (currentPriceTotal && predictedPriceTotal) {
    // Show source indicator
    const sourceIcon = priceSource === 'live_api' ? '🔴' : '📊';
    const sourceText = priceSource === 'live_api' ? 'Live' : 'Historical';
    const sourceClass = priceSource === 'live_api' ? 'text-green-600' : 'text-yellow-600';
    
    currentPriceTotal.innerHTML = `Total: ₹${currentTotal.toLocaleString()} (${quantity} qtl) <span class="text-xs ml-2 ${sourceClass}">${sourceIcon} ${sourceText}</span>`;
    predictedPriceTotal.textContent = `Total: ₹${predictedTotal.toLocaleString()} (${quantity} qtl)`;
    currentPriceTotal.classList.remove('hidden');
    predictedPriceTotal.classList.remove('hidden');
  }

  // Set the quantity input field for post-prediction adjustments
  const quantityAfterInput = document.getElementById('pred-quantity-after');
  if (quantityAfterInput) {
    quantityAfterInput.value = quantity;
  }

  document.getElementById('prediction-results').classList.remove('hidden');
  // Pass quantity to chart for display - include all parameters
  initPredictionChart(commodity, currentPrice, predictedPrice, quantile, parseInt(quantity));
}

// Update prediction with new quantile without re-entering form data
function updatePredictionWithNewQuantile() {
  // Get current form values
  const commodity = document.getElementById('pred-commodity').value;
  const district = document.getElementById('pred-district').value;
  const market = document.getElementById('pred-market').value;
  const quantile = parseFloat(document.getElementById('pred-quantile').value);
  
  if (!commodity || !district || !market) {
    showToast('Please fill all fields to update prediction', '⚠️');
    return;
  }
  
  // Get current price
  const currentPrice = getDailyPrice(commodity, district, market);
  
  // Calculate predicted price based on quantile
  const basePredictedPrice = calculatePredictedPrice(currentPrice, commodity, 7, district, market);
  const predictedPrice = calculateQuantilePrice(basePredictedPrice, quantile, commodity);
  
  // Update current prediction data
  currentPredictionData = {
    commodity: commodity,
    district: district,
    market: market,
    currentPrice: currentPrice,
    predictedPrice: predictedPrice,
    quantile: quantile
  };
  
  // Update DOM with new prices
  document.getElementById('current-price').textContent = `₹${currentPrice.toLocaleString()}`;
  document.getElementById('predicted-price').textContent = `₹${predictedPrice.toLocaleString()}`;
  
  // Update quantile badge
  const quantileLabel = getQuantileLabel(quantile);
  const predictedPriceCard = document.getElementById('predicted-price').closest('.bg-gradient-to-br');
  if (predictedPriceCard) {
    let quantileBadge = predictedPriceCard.querySelector('.quantile-badge');
    if (!quantileBadge) {
      // Create badge if it doesn't exist
      quantileBadge = document.createElement('span');
      quantileBadge.className = 'quantile-badge text-xs mt-2 block';
      predictedPriceCard.appendChild(quantileBadge);
    }
    quantileBadge.textContent = `Quantile: ${quantileLabel}`;
  }
  
  // Update chart with new predicted price
  initPredictionChart(commodity, currentPrice, predictedPrice, quantile);
  
  // Show notification
  showToast(`Price updated with ${quantileLabel} quantile`, '🔄');
}

// Calculate price based on quantile selection
// Quantiles: 0.10 = conservative (lower price), 0.50 = median, 0.90 = aggressive (higher price)
function calculateQuantilePrice(basePrice, quantile, commodity) {
  // Get commodity-specific volatility for realistic quantile adjustments
  const volatilityMap = {
    'Maize': 0.15,      // 15% volatility
    'Paddy': 0.12,      // 12% volatility
    'Wheat': 0.10,      // 10% volatility
    'Sugarcane': 0.08   // 8% volatility
  };
  
  const volatility = volatilityMap[commodity] || 0.12;
  
  // Calculate quantile adjustment factor
  // For quantile 0.10: price - (volatility * 0.8) = lower bound
  // For quantile 0.50: price (median)
  // For quantile 0.90: price + (volatility * 0.8) = upper bound
  
  // Z-score approximation for common quantiles
  const zScores = {
    0.10: -1.28,
    0.25: -0.67,
    0.50: 0,
    0.75: 0.67,
    0.90: 1.28
  };
  
  const zScore = zScores[quantile] || 0;
  const adjustmentFactor = zScore * volatility;
  
  // Apply adjustment to base price
  let adjustedPrice = Math.round(basePrice * (1 + adjustmentFactor));
  
  // Ensure price stays within reasonable bounds (±25% of base)
  const minPrice = Math.round(basePrice * 0.75);
  const maxPrice = Math.round(basePrice * 1.25);
  adjustedPrice = Math.max(minPrice, Math.min(maxPrice, adjustedPrice));
  
  return adjustedPrice;
}

// Get human-readable label for quantile
function getQuantileLabel(quantile) {
  const labels = {
    0.10: 'Conservative (10%)',
    0.25: 'Lower Bound (25%)',
    0.50: 'Median (50%)',
    0.75: 'Upper Bound (75%)',
    0.90: 'Aggressive (90%)'
  };
  return labels[quantile] || 'Median (50%)';
}

// Setup listener for quantile changes to update prediction dynamically
function setupQuantileUpdateListener() {
  const quantileSelect = document.getElementById('pred-quantile');
  if (!quantileSelect) return;
  
  // Remove existing listener to avoid duplicates
  quantileSelect.onchange = null;
  
  quantileSelect.onchange = function() {
    const commodity = document.getElementById('pred-commodity').value;
    const district = document.getElementById('pred-district').value;
    const market = document.getElementById('pred-market').value;
    const quantile = parseFloat(this.value);
    
    if (!commodity || !district || !market) {
      showToast('Please fill all fields to update prediction', '⚠️');
      return;
    }
    
    const today = getTodayDate();
    
    // Get current price (doesn't change)
    const currentPrice = getDailyPrice(commodity, district, market);
    
    // Calculate new predicted price with quantile adjustment
    // Pass district and market for market-specific prediction
    const basePredictedPrice = calculatePredictedPrice(currentPrice, commodity, 7, district, market);
    const predictedPrice = calculateQuantilePrice(basePredictedPrice, quantile, commodity);
    
    // Update current prediction data
    currentPredictionData = {
      commodity: commodity,
      district: district,
      market: market,
      currentPrice: currentPrice,
      predictedPrice: predictedPrice,
      quantile: quantile
    };
    
    // Update DOM with new prices
    document.getElementById('current-price').textContent = `₹${currentPrice.toLocaleString()}`;
    document.getElementById('predicted-price').textContent = `₹${predictedPrice.toLocaleString()}`;
    
    // Update quantile badge
    const quantileLabel = getQuantileLabel(quantile);
    const predictedPriceCard = document.getElementById('predicted-price').closest('.bg-gradient-to-br');
    if (predictedPriceCard) {
      let quantileBadge = predictedPriceCard.querySelector('.quantile-badge');
      if (quantileBadge) {
        quantileBadge.textContent = `Quantile: ${quantileLabel}`;
      }
    }
    
    // Update chart with new predicted price
    initPredictionChart(commodity, currentPrice, predictedPrice);
    
    // Show notification
    showToast(`Price updated with ${quantileLabel} quantile`, '🔄');
  };
}

// Setup dynamic update listeners for prediction form after prediction is made
function setupPredictionDynamicUpdates() {
  // Get the form elements
  const districtSelect = document.getElementById('pred-district');
  const marketSelect = document.getElementById('pred-market');
  
  if (!districtSelect || !marketSelect) return;
  
  // Remove any existing listeners to avoid duplicates
  districtSelect.onchange = null;
  marketSelect.onchange = null;
  
  // Function to update prediction based on current form values
  const updatePrediction = async function() {
    const commodity = document.getElementById('pred-commodity').value;
    const district = document.getElementById('pred-district').value;
    const market = document.getElementById('pred-market').value;
    const quantity = document.getElementById('pred-quantity').value;
    
    // Only update if all required fields have values
    if (!commodity || !district || !market || !quantity) {
      showToast('Please fill all fields to update prediction', '⚠️');
      return;
    }
    
    // Get current date for dynamic pricing
    const today = getTodayDate();
    
    // Create unique key for this prediction combination
    const predictionKey = `${commodity}_${district}_${market}_${today}`;
    
    let currentPrice, predictedPrice;
    
    // Check if we already have this prediction cached
    if (storedPredictionValues[predictionKey]) {
      currentPrice = storedPredictionValues[predictionKey].currentPrice;
      predictedPrice = storedPredictionValues[predictionKey].predictedPrice;
    } else {
      // Get DYNAMIC current price - changes based on real market conditions
      currentPrice = getDailyPrice(commodity, district, market);
      
      // Calculate predicted price - pass district and market for market-specific factors
      predictedPrice = calculatePredictedPrice(currentPrice, commodity, 7, district, market);
      
      // Cache this prediction
      storedPredictionValues[predictionKey] = {
        currentPrice,
        predictedPrice,
        commodity,
        date: today
      };
    }
    
    // Update current prediction data
    currentPredictionData = {
      commodity: commodity,
      district: district,
      market: market,
      currentPrice: currentPrice,
      predictedPrice: predictedPrice
    };
    
    // Update DOM with new prices
    document.getElementById('current-price').textContent = `₹${currentPrice.toLocaleString()}`;
    document.getElementById('predicted-price').textContent = `₹${predictedPrice.toLocaleString()}`;
    
    // Update chart
    initPredictionChart(commodity, currentPrice, predictedPrice);
    
    // Show toast notification
    showToast(`Prediction updated for ${commodity}`, '🔄');
  };
  
  // Attach event listeners
  districtSelect.onchange = function() {
    // First update the markets dropdown
    updatePredMarkets();
    // Then update prediction if markets are loaded
    setTimeout(updatePrediction, 50);
  };
  marketSelect.onchange = updatePrediction;
}

// Helper function to generate consistent hash from string
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// Activity Logging
async function logActivity(type, description) {
  // Create activity object
  const activity = {
    type: 'activity',
    username: currentUser?.username || 'Anonymous',
    activity_type: type,
    description: description,
    created_at: new Date().toISOString(),
    __backendId: Date.now() // Temporary ID for local storage
  };
  
  // Always add to local data (works with or without backend)
  allData.push(activity);
  
  // Save to localStorage for persistence
  saveActivitiesToLocalStorage();
  
  // Try to sync with backend if available (non-blocking)
  if (window.dataSdk && allData.length < 999) {
    window.dataSdk.create(activity).catch(() => {});
  }
  
  // Update UI immediately
  updateAllStats();
  updateActivityTimeline();
}

// Save activities to localStorage
function saveActivitiesToLocalStorage() {
  const activities = allData.filter(d => d.type === 'activity');
  localStorage.setItem('agripredict_activities', JSON.stringify(activities));
}

// Load activities from localStorage on startup
function loadActivitiesFromLocalStorage() {
  const stored = localStorage.getItem('agripredict_activities');
  if (stored) {
    try {
      const activities = JSON.parse(stored);
      activities.forEach(activity => {
        // Avoid duplicates
        const exists = allData.some(d => d.__backendId === activity.__backendId);
        if (!exists) {
          allData.push(activity);
        }
      });
    } catch (e) {
      console.log('Error loading activities from localStorage');
    }
  }
}

// UI Update Functions
function updateUserProfile() {
  if (!currentUser) return;
  const userName = currentUser.username || 'User';
  
  // Update sidebar user info (check if element exists)
  const sidebarUsername = document.getElementById('sidebar-username');
  if (sidebarUsername) sidebarUsername.textContent = userName;
  
  // Update header user info
  const headerUsername = document.getElementById('header-username');
  if (headerUsername) headerUsername.textContent = userName;
  
  // Update profile section (check if elements exist)
  const profileName = document.getElementById('profile-name');
  if (profileName) profileName.textContent = userName;
  
  const profileEmail = document.getElementById('profile-email');
  if (profileEmail) profileEmail.textContent = currentUser.email || 'N/A';
  
  const profilePhone = document.getElementById('profile-phone');
  if (profilePhone) profilePhone.textContent = currentUser.phone ? `+91 ${currentUser.phone}` : 'N/A';
  
  // Update profile heading with user's name
  const profileHeading = document.getElementById('profile-heading');
  if (profileHeading) {
    profileHeading.textContent = `${userName}'s Profile`;
  }
}

function updateAdminProfile() {
  if (!currentUser) return;
  
  const adminSidebarName = document.getElementById('admin-sidebar-name');
  if (adminSidebarName) adminSidebarName.textContent = currentUser.username || 'Admin';
  
  const adminProfileName = document.getElementById('admin-profile-name');
  if (adminProfileName) adminProfileName.textContent = currentUser.username || 'Admin';
  
  const adminProfileEmail = document.getElementById('admin-profile-email');
  if (adminProfileEmail) adminProfileEmail.textContent = currentUser.email || 'admin@agripredict.com';
  
  const adminProfilePhone = document.getElementById('admin-profile-phone');
  if (adminProfilePhone) adminProfilePhone.textContent = currentUser.phone ? `+91 ${currentUser.phone}` : 'N/A';
}

function updateAllStats() {
  const users = allData.filter(d => d.type === 'user');
  const activities = allData.filter(d => d.type === 'activity');
  const searches = activities.filter(a => a.activity_type === 'market_search');
  const predictions = activities.filter(a => a.activity_type === 'prediction');
  const marketRecords = allData.filter(d => d.type === 'market_record');

  // Get dataset records count from historicalDataset (60 records from 2021-2025)
  const datasetRecords = historicalDataset.length;

  // Admin stats - use dataset records count instead of market_record type
  document.getElementById('admin-total-users').textContent = users.length;
  document.getElementById('admin-total-activities').textContent = activities.length;
  document.getElementById('admin-predictions').textContent = predictions.length;
  document.getElementById('admin-records').textContent = datasetRecords;

  // Data management stats - use dataset records count
  document.getElementById('data-total-records').textContent = datasetRecords;
  
  // Update total markets in data management
  document.getElementById('data-total-markets').textContent = getTotalMarketsCount();

  // Activity stats
  document.getElementById('activity-searches').textContent = searches.length;
  document.getElementById('activity-predictions').textContent = predictions.length;
  document.getElementById('activity-total').textContent = activities.length;

  // Users stats
  const admins = users.filter(u => u.role === 'admin');
  const activeUsers = users.filter(u => u.status === 'active');
  const today = new Date().toISOString().split('T')[0];
  const todayUsers = users.filter(u => u.created_at && u.created_at.startsWith(today));

  document.getElementById('users-total').textContent = users.length;
  document.getElementById('users-active').textContent = activeUsers.length;
  document.getElementById('users-admins').textContent = admins.length;
  document.getElementById('users-today').textContent = todayUsers.length;
}

function updateUserStats() {
  if (!currentUser) return;
  const userActivities = allData.filter(d => d.type === 'activity' && d.username === currentUser.username);
  const searches = userActivities.filter(a => a.activity_type === 'market_search');
  const predictions = userActivities.filter(a => a.activity_type === 'prediction');

  document.getElementById('user-searches').textContent = searches.length;
  document.getElementById('user-predictions').textContent = predictions.length;
}

function updateUsersTable() {
  const users = allData.filter(d => d.type === 'user');
  const tbody = document.getElementById('users-table-body');
  
  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-8 text-center text-gray-500">No users registered yet</td></tr>';
    return;
  }

  tbody.innerHTML = users.map(user => `
    <tr class="border-t border-gray-200 hover:bg-gray-50">
      <td class="px-6 py-4 text-sm font-medium text-gray-800">${user.username || 'N/A'}</td>
      <td class="px-6 py-4 text-sm text-gray-600">${user.email || 'N/A'}</td>
      <td class="px-6 py-4 text-sm text-gray-600">${user.phone || 'N/A'}</td>
      <td class="px-6 py-4">
        <span class="px-2 py-1 text-xs font-medium rounded-full ${user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}">
          ${user.role || 'user'}
        </span>
      </td>
      <td class="px-6 py-4">
        <span class="px-2 py-1 text-xs font-medium rounded-full ${user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
          ${user.status || 'active'}
        </span>
      </td>
      <td class="px-6 py-4 text-sm text-gray-600">${user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</td>
      <td class="px-6 py-4">
        <button onclick="editUser('${user.__backendId}')" class="text-blue-600 hover:text-blue-800 text-sm font-medium">Edit</button>
      </td>
    </tr>
  `).join('');
}

function updateActivityTimeline() {
  const activities = allData.filter(d => d.type === 'activity').slice(-10).reverse();
  const timeline = document.getElementById('activity-timeline');
  
  if (activities.length === 0) {
    timeline.innerHTML = '<p class="text-gray-500 text-center py-8">No activities recorded yet</p>';
    return;
  }

  const icons = {
    'login': '🔐',
    'admin_login': '🛡️',
    'market_search': '🔍',
    'prediction': '🤖'
  };

  timeline.innerHTML = activities.map(activity => `
    <div class="flex items-start gap-4 p-3 bg-gray-50 rounded-xl">
      <div class="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow">
        <span class="text-lg">${icons[activity.activity_type] || '📌'}</span>
      </div>
      <div class="flex-1">
        <p class="font-medium text-gray-800">${activity.description || 'Activity'}</p>
        <p class="text-sm text-gray-500">${activity.username || 'Unknown'} • ${activity.created_at ? new Date(activity.created_at).toLocaleString() : 'N/A'}</p>
      </div>
    </div>
  `).join('');
}

// Chart Initializations
function initSearchChart(commodity, currentPrice) {
  const ctx = document.getElementById('search-chart');
  if (!ctx) return;
  
  if (charts.search) charts.search.destroy();
  
  // Years for Y-axis (as requested)
  const years = ['2021', '2022', '2023', '2024', '2025', '2026', '2027', '2028', '2029', '2030', '2031'];
  
  // Get base price for the commodity (accurate prices)
  const baseCommodityPrice = basePrices[commodity] || 2000;
  
  // Generate accurate prices for 1 quintal across years
  // Prices are based on the commodity's base price with realistic year-over-year variation
  const prices = years.map((year) => {
    // Calculate price with realistic year-over-year variation (-3% to +3% per year)
    const yearNum = parseInt(year);
    const variation = ((yearNum - 2021) * 1.5) + ((yearNum % 3) - 1) * 2; // Trend + seasonal variation
    const price = Math.round(baseCommodityPrice * (1 + variation / 100));
    return price;
  });
  
  // Use horizontal bar chart to show:
  // X-axis: Amount (1 quintal)
  // Y-axis: Years
  charts.search = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: years,
      datasets: [{
        label: 'Price for 1 Quintal (₹)',
        data: prices,
        backgroundColor: prices.map((_, i) => {
          // Create gradient from teal to emerald
          const alpha = 0.4 + (i * 0.06);
          return `rgba(13, 148, 136, ${Math.min(alpha, 1)})`;
        }),
        borderColor: '#0d9488',
        borderWidth: 1,
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: 'y', // This makes it horizontal - Y-axis becomes categories (years)
      responsive: true,
      maintainAspectRatio: false,
      plugins: { 
        legend: { position: 'bottom' },
        title: {
          display: true,
          text: `${commodity} Price Chart - 1 Quintal`,
          font: {
            size: 16,
            weight: 'bold'
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `₹${context.parsed.x.toLocaleString()}/quintal`;
            }
          }
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Amount (Quintals)'
          },
          beginAtZero: false,
          ticks: {
            callback: function(value) {
              return value + ' qtl';
            }
          }
        },
        y: {
          title: {
            display: true,
            text: 'Years'
          },
          grid: {
            display: false
          }
        }
      }
    }
  });
}

function initPredictionChart(commodity, currentPrice, predictedPrice, quantile = 0.5, quantity = 1) {
  const ctx = document.getElementById('prediction-chart');
  if (!ctx) return;
  
  if (charts.prediction) charts.prediction.destroy();
  
  // Calculate percentage change for better understanding
  const priceChange = ((predictedPrice - currentPrice) / currentPrice) * 100;
  const isPositive = priceChange >= 0;
  
  // Set default quantity if not provided
  quantity = quantity || 1;
  
  // Generate more realistic historical data (past 4 weeks)
  const historicalPrices = [
    currentPrice - Math.round(currentPrice * 0.05),
    currentPrice - Math.round(currentPrice * 0.03),
    currentPrice - Math.round(currentPrice * 0.01),
    currentPrice
  ];
  
  // Generate predicted data with trend
  const futurePrices = [];
  for (let i = 0; i < 4; i++) {
    const progress = (i + 1) / 4;
    const basePredicted = currentPrice + (predictedPrice - currentPrice) * progress;
    // Add some realistic variation
    const variation = (Math.random() * 40 - 20) * (1 - progress * 0.5);
    futurePrices.push(Math.round(basePredicted + variation));
  }
  
  // Calculate confidence interval bounds for predicted prices
  const upperBound = futurePrices.map(p => Math.round(p * 1.08)); // +8%
  const lowerBound = futurePrices.map(p => Math.round(p * 0.92)); // -8%
  
  // Labels with better formatting
  const labels = [
    '3 Weeks Ago',
    '2 Weeks Ago', 
    'Last Week',
    'Today',
    'Next Week',
    'In 2 Weeks',
    'In 3 Weeks',
    'In 4 Weeks'
  ];
  
  // Create the improved chart
  charts.prediction = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        // Confidence interval area (filled between upper and lower bounds) - colorful gradient
        {
          label: 'Confidence Range',
          data: [null, null, null, null, ...upperBound],
          borderColor: 'transparent',
          backgroundColor: function(context) {
            const chart = context.chart;
            const {ctx, chartArea} = chart;
            if (!chartArea) return 'rgba(147, 51, 234, 0.2)';
            const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
            gradient.addColorStop(0, 'rgba(236, 72, 153, 0.05)');
            gradient.addColorStop(0.5, 'rgba(139, 92, 246, 0.15)');
            gradient.addColorStop(1, 'rgba(59, 130, 246, 0.25)');
            return gradient;
          },
          fill: '+1',
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 0,
          borderWidth: 0
        },
        {
          label: 'Lower Bound',
          data: [null, null, null, null, ...lowerBound],
          borderColor: 'transparent',
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 0,
          borderWidth: 0
        },
        // Historical prices line - with rainbow colored points
        {
          label: 'Historical Prices',
          data: [...historicalPrices, null, null, null, null],
          borderColor: function(context) {
            const chart = context.chart;
            const {ctx, chartArea} = chart;
            if (!chartArea) return '#ff6b6b';
            const gradient = ctx.createLinearGradient(0, chartArea.left, chartArea.right, 0);
            gradient.addColorStop(0, '#ff6b6b');
            gradient.addColorStop(0.5, '#ffa502');
            gradient.addColorStop(1, '#ff6b6b');
            return gradient;
          },
          backgroundColor: function(context) {
            const chart = context.chart;
            const {ctx, chartArea} = chart;
            if (!chartArea) return 'rgba(255, 107, 107, 0.1)';
            const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
            gradient.addColorStop(0, 'rgba(255, 107, 107, 0.02)');
            gradient.addColorStop(1, 'rgba(255, 165, 2, 0.2)');
            return gradient;
          },
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: ['#ef4444', '#f97316', '#eab308', '#f59e0b'],
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 7,
          pointHoverRadius: 10
        },
        // Current price marker
        {
          label: 'Current Price',
          data: [null, null, null, currentPrice, currentPrice, currentPrice, currentPrice, currentPrice],
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 3, fill: false, tension: 0,
          pointBackgroundColor: '#3b82f6', pointBorderColor: '#ffffff', pointBorderWidth: 2,
          pointRadius: 4, pointHoverRadius: 6
        },
        // Predicted prices line
        {
          label: 'Predicted Prices',
          data: [null, null, null, currentPrice, ...futurePrices],
          borderColor: isPositive ? '#10b981' : '#ef4444',
          backgroundColor: isPositive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          borderWidth: 3,
          borderDash: undefined,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: isPositive ? '#10b981' : '#ef4444',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 8
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            usePointStyle: true,
            padding: 20,
            font: {
              size: 12,
              family: "'Poppins', sans-serif"
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(17, 24, 39, 0.95)',
          titleFont: {
            size: 14,
            weight: 'bold',
            family: "'Poppins', sans-serif"
          },
          bodyFont: {
            size: 13,
            family: "'Poppins', sans-serif"
          },
          padding: 12,
          cornerRadius: 8,
          displayColors: true,
          callbacks: {
            title: function(context) {
              return context[0].label;
            },
            label: function(context) {
              if (context.dataset.label === 'Confidence Range' || 
                  context.dataset.label === 'Lower Bound' ||
                  context.dataset.label === 'Current Price') {
                return null;
              }
              const value = context.parsed.y;
              if (value === null) return null;
              
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              label += '₹' + value.toLocaleString() + '/quintal';
              
              // Add percentage change for predicted prices
              if (context.dataset.label === 'Predicted Prices' && context.dataIndex > 3) {
                const changeFromCurrent = ((value - currentPrice) / currentPrice * 100).toFixed(1);
                const changeIcon = changeFromCurrent >= 0 ? '↑' : '↓';
                label += ` (${changeIcon} ${Math.abs(changeFromCurrent)}%)`;
              }
              
              return label;
            },
            afterBody: function(context) {
              // Add summary for predicted week
              const predictedData = context.find(c => c.dataset.label === 'Predicted Prices' && c.dataIndex === 7);
              if (predictedData && predictedData.parsed.y) {
                const finalPredicted = predictedData.parsed.y;
                const totalChange = ((finalPredicted - currentPrice) / currentPrice * 100).toFixed(1);
                const changeIcon = totalChange >= 0 ? '📈' : '📉';
                return ['\n' + changeIcon + ' Total Expected Change: ' + (totalChange >= 0 ? '+' : '') + totalChange + '%'];
              }
              return [];
            }
          }
        },
        title: {
          display: true,
          text: `${commodity} Price Forecast - Next 4 Weeks`,
          font: {
            size: 16,
            weight: 'bold',
            family: "'Poppins', sans-serif"
          },
          color: '#1f2937',
          padding: {
            bottom: 20
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            font: {
              size: 11,
              family: "'Poppins', sans-serif"
            },
            color: '#6b7280'
          }
        },
        y: {
          title: {
            display: true,
            text: 'Price (₹/quintal)',
            font: {
              size: 12,
              weight: '500',
              family: "'Poppins', sans-serif"
            },
            color: '#6b7280'
          },
          grid: {
            color: 'rgba(107, 114, 128, 0.1)'
          },
          ticks: {
            callback: function(value) {
              return '₹' + value.toLocaleString();
            },
            font: {
              size: 11,
              family: "'Poppins', sans-serif"
            },
            color: '#6b7280'
          },
          beginAtZero: false,
          suggestedMin: Math.min(...historicalPrices) * 0.95,
          suggestedMax: Math.max(...futurePrices, ...upperBound) * 1.1
        }
      }
    }
  });
}

function initAdminCharts() {
  const ctx = document.getElementById('admin-overview-chart');
  if (!ctx) return;
  
  if (charts.adminOverview) charts.adminOverview.destroy();
  
  const users = allData.filter(d => d.type === 'user').length;
  const activities = allData.filter(d => d.type === 'activity').length;
  const searches = allData.filter(d => d.activity_type === 'market_search').length;
  const predictions = allData.filter(d => d.activity_type === 'prediction').length;
  
  charts.adminOverview = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Users', 'Market Searches', 'Predictions', 'Other Activities'],
      datasets: [{
        data: [users || 1, searches || 1, predictions || 1, Math.max(0, activities - searches - predictions) || 1],
        backgroundColor: ['#10b981', '#0ea5e9', '#8b5cf6', '#f59e0b'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#fff' } }
      }
    }
  });
}

function initDataChart() {
  const ctx = document.getElementById('data-chart');
  if (!ctx) return;
  
  if (charts.data) charts.data.destroy();
  
  // Average Prices per Quintal (in Rupees) for years 2021-2028
  const years = ['2021', '2022', '2023', '2024', '2025', '2026', '2027', '2028'];
  const commodities = ['Maize', 'Paddy', 'Wheat', 'Sugarcane'];
  
  // Base prices per commodity
  const basePricesData = {
    'Maize': 2150,
    'Paddy': 1940,
    'Wheat': 2275,
    'Sugarcane': 310
  };
  
  // Generate average prices for each year (2021-2028) with projected values
  const maizPrices = [2050, 2080, 2120, 2180, 2150, 2200, 2250, 2300];
  const paddyPrices = [1850, 1900, 1920, 1960, 1940, 1980, 2020, 2060];
  const wheatPrices = [2180, 2220, 2250, 2300, 2275, 2320, 2370, 2420];
  const sugarcanePrices = [290, 300, 305, 315, 310, 320, 330, 340];
  
  const commodityData = {
    'Maize': maizPrices,
    'Paddy': paddyPrices,
    'Wheat': wheatPrices,
    'Sugarcane': sugarcanePrices
  };
  
  const colors = {
    'Maize': { bg: 'rgba(251, 191, 36, 0.8)', border: 'rgb(251, 191, 36)' },
    'Paddy': { bg: 'rgba(96, 165, 250, 0.8)', border: 'rgb(96, 165, 250)' },
    'Wheat': { bg: 'rgba(167, 139, 250, 0.8)', border: 'rgb(167, 139, 250)' },
    'Sugarcane': { bg: 'rgba(52, 211, 153, 0.8)', border: 'rgb(52, 211, 153)' }
  };
  
  // Create datasets for each commodity
  const datasets = commodities.map(commodity => ({
    label: `${commodity} (₹/quintal)`,
    data: commodityData[commodity],
    backgroundColor: colors[commodity].bg,
    borderColor: colors[commodity].border,
    borderWidth: 2,
    borderRadius: 6
  }));
  
  charts.data = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: years,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { 
        legend: { 
          display: true,
          position: 'top',
          labels: {
            color: '#374151',
            usePointStyle: true,
            padding: 20
          }
        },
        title: {
          display: true,
          text: 'Average Commodity Prices (2021-2028)',
          font: {
            size: 16,
            weight: 'bold'
          },
          color: '#1f2937',
          padding: {
            bottom: 20
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: ₹${context.parsed.y.toLocaleString()}/quintal`;
            }
          }
        }
      },
      scales: {
        y: {
          display: true,
          position: 'left',
          title: {
            display: true,
            text: 'Price (₹/quintal)',
            color: '#6b7280'
          },
          beginAtZero: false
        },
        x: {
          title: {
            display: true,
            text: 'Years',
            color: '#6b7280'
          }
        }
      }
    }
  });
}

// Modal Functions
function showModal(content) {
  document.getElementById('modal-content').innerHTML = content;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function hideModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

function showForgotPasswordModal() {
  showModal(`
    <h3 class="text-xl font-bold text-gray-800 mb-2">Reset Password</h3>
    <p class="text-gray-600 text-sm mb-4">Enter your registered email address to receive password reset instructions.</p>
    <form onsubmit="handleForgotPassword(event)">
      <div class="mb-4">
        <label class="block text-gray-700 font-medium mb-2">Email Address</label>
        <input type="email" id="forgot-email" required class="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-teal-500" placeholder="Enter your email">
      </div>
      <div id="forgot-error" class="hidden mb-4 p-3 bg-red-100 text-red-700 rounded-xl text-sm"></div>
      <div id="forgot-success" class="hidden mb-4 p-3 bg-green-100 text-green-700 rounded-xl text-sm"></div>
      <div class="flex gap-3">
        <button type="button" onclick="hideModal()" class="flex-1 py-3 border-2 border-gray-300 text-gray-600 rounded-xl font-bold hover:bg-gray-50">Cancel</button>
        <button type="submit" id="forgot-submit-btn" class="flex-1 py-3 bg-teal-600 text-white rounded-xl font-bold hover:bg-teal-700">Send Reset Link</button>
      </div>
    </form>
  `);
}

async function handleForgotPassword(e) {
  e.preventDefault();
  const email = document.getElementById('forgot-email').value;
  const errorEl = document.getElementById('forgot-error');
  const successEl = document.getElementById('forgot-success');
  const submitBtn = document.getElementById('forgot-submit-btn');
  
  // Hide any previous messages
  errorEl.classList.add('hidden');
  successEl.classList.add('hidden');
  
  // Disable button during processing
  submitBtn.textContent = 'Sending...';
  submitBtn.disabled = true;
  
  // Check if user exists using the user index
  const existingUser = userIndexByEmail.get(email.toLowerCase());
  
  if (!existingUser) {
    errorEl.textContent = 'No account found with this email address. Please register first.';
    errorEl.classList.remove('hidden');
    submitBtn.textContent = 'Send Reset Link';
    submitBtn.disabled = false;
    return;
  }
  
  // Simulate sending password reset email
  // In a real application, this would call a backend API
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Show success message
  successEl.innerHTML = `<strong>Password reset link sent!</strong><br>A password reset link has been sent to <strong>${email}</strong>. Please check your inbox and follow the instructions.`;
  successEl.classList.remove('hidden');
  
  // Reset button
  submitBtn.textContent = 'Send Reset Link';
  submitBtn.disabled = false;
  
  // Close modal after 3 seconds
  setTimeout(() => {
    hideModal();
  }, 3000);
}

function showEditProfileModal() {
  showModal(`
    <h3 class="text-xl font-bold text-gray-800 mb-4">Edit Profile</h3>
    <form onsubmit="updateProfile(event)">
      <div class="mb-4">
        <label class="block text-gray-700 font-medium mb-2">Name</label>
        <input type="text" id="edit-name" value="${currentUser?.username || ''}" class="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-emerald-500">
      </div>
      <div class="mb-4">
        <label class="block text-gray-700 font-medium mb-2">Email</label>
        <input type="email" id="edit-email" value="${currentUser?.email || ''}" class="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-emerald-500">
      </div>
      <div class="mb-6">
        <label class="block text-gray-700 font-medium mb-2">Mobile</label>
        <input type="tel" id="edit-phone" value="${currentUser?.phone || ''}" class="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-emerald-500">
      </div>
      <div class="flex gap-3">
        <button type="button" onclick="hideModal()" class="flex-1 py-3 border-2 border-gray-300 text-gray-600 rounded-xl font-bold hover:bg-gray-50">Cancel</button>
        <button type="submit" class="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700">Save</button>
      </div>
    </form>
  `);
}

function showAdminEditProfileModal() {
  showEditProfileModal();
}

function showChangePasswordModal() {
  showModal(`
    <h3 class="text-xl font-bold text-gray-800 mb-4">Change Password</h3>
    <form onsubmit="updatePassword(event)">
      <div class="mb-4">
        <label class="block text-gray-700 font-medium mb-2">Current Password</label>
        <input type="password" id="current-pass" required class="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-emerald-500">
      </div>
      <div class="mb-4">
        <label class="block text-gray-700 font-medium mb-2">New Password</label>
        <input type="password" id="new-pass" required minlength="6" class="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-emerald-500">
      </div>
      <div class="mb-6">
        <label class="block text-gray-700 font-medium mb-2">Confirm New Password</label>
        <input type="password" id="confirm-pass" required class="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-emerald-500">
      </div>
      <div id="pass-error" class="hidden mb-4 p-3 bg-red-100 text-red-700 rounded-xl text-sm"></div>
      <div class="flex gap-3">
        <button type="button" onclick="hideModal()" class="flex-1 py-3 border-2 border-gray-300 text-gray-600 rounded-xl font-bold hover:bg-gray-50">Cancel</button>
        <button type="submit" class="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700">Update</button>
      </div>
    </form>
  `);
}

async function updateProfile(e) {
  e.preventDefault();
  if (!currentUser || !currentUser.__backendId) {
    showToast('Unable to update profile', '❌');
    hideModal();
    return;
  }

  const updatedUser = {
    ...currentUser,
    username: document.getElementById('edit-name').value,
    email: document.getElementById('edit-email').value,
    phone: document.getElementById('edit-phone').value
  };

  const result = await window.dataSdk.update(updatedUser);
  if (result.isOk) {
    currentUser = updatedUser;
    if (isAdmin) {
      updateAdminProfile();
    } else {
      updateUserProfile();
    }
    showToast('Profile updated successfully!', '✅');
  } else {
    showToast('Failed to update profile', '❌');
  }
  hideModal();
}

async function updatePassword(e) {
  e.preventDefault();
  const currentPass = document.getElementById('current-pass').value;
  const newPass = document.getElementById('new-pass').value;
  const confirmPass = document.getElementById('confirm-pass').value;
  const errorEl = document.getElementById('pass-error');

  if (currentPass !== currentUser?.password) {
    errorEl.textContent = 'Current password is incorrect';
    errorEl.classList.remove('hidden');
    return;
  }

  if (newPass !== confirmPass) {
    errorEl.textContent = 'New passwords do not match';
    errorEl.classList.remove('hidden');
    return;
  }

  if (!currentUser || !currentUser.__backendId) {
    showToast('Unable to update password', '❌');
    hideModal();
    return;
  }

  const updatedUser = { ...currentUser, password: newPass };
  const result = await window.dataSdk.update(updatedUser);
  
  if (result.isOk) {
    currentUser = updatedUser;
    showToast('Password updated successfully!', '✅');
  } else {
    showToast('Failed to update password', '❌');
  }
  hideModal();
}

async function editUser(backendId) {
  // Convert to number to handle both string and number comparisons
  const userId = Number(backendId);
  const user = allData.find(d => d.__backendId === userId || d.__backendId === backendId);
  if (!user) {
    showToast('User not found', '❌');
    return;
  }

  showModal(`
    <h3 class="text-xl font-bold text-gray-800 mb-4">Edit User</h3>
    <form onsubmit="saveUserEdit(event, '${backendId}')">
      <div class="mb-4">
        <label class="block text-gray-700 font-medium mb-2">Username</label>
        <input type="text" id="edit-user-name" value="${user.username || ''}" class="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-emerald-500">
      </div>
      <div class="mb-4">
        <label class="block text-gray-700 font-medium mb-2">Email</label>
        <input type="text" value="${user.email || ''}" class="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-gray-100 text-gray-500" readonly>
        <p class="text-xs text-gray-400 mt-1">Email cannot be changed</p>
      </div>
      <div class="mb-4">
        <label class="block text-gray-700 font-medium mb-2">Mobile</label>
        <input type="text" value="${user.phone ? '+91 ' + user.phone : 'N/A'}" class="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-gray-100 text-gray-500" readonly>
        <p class="text-xs text-gray-400 mt-1">Phone number cannot be changed</p>
      </div>
      <div class="mb-6">
        <label class="block text-gray-700 font-medium mb-2">Status</label>
        <select id="edit-user-status" class="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-emerald-500">
          <option value="active" ${user.status === 'active' ? 'selected' : ''}>Active</option>
          <option value="inactive" ${user.status === 'inactive' ? 'selected' : ''}>Blocked (Inactive)</option>
        </select>
        <p class="text-xs text-gray-500 mt-1">Select "Blocked (Inactive)" to block user access</p>
      </div>
      <div class="flex gap-3">
        <button type="button" onclick="hideModal()" class="flex-1 py-3 border-2 border-gray-300 text-gray-600 rounded-xl font-bold hover:bg-gray-50">Cancel</button>
        <button type="submit" class="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700">Save</button>
      </div>
    </form>
  `);
}

async function saveUserEdit(e, backendId) {
  e.preventDefault();
  // Convert to number to handle both string and number comparisons
  const userId = Number(backendId);
  const userIndex = allData.findIndex(d => d.__backendId === userId || d.__backendId === backendId);
  if (userIndex === -1) {
    showToast('User not found', '❌');
    hideModal();
    return;
  }

  const oldUser = allData[userIndex];
  // Keep original email and phone (they are now read-only in the edit form)
  const updatedUser = {
    ...oldUser,
    username: document.getElementById('edit-user-name').value,
    email: oldUser.email, // Keep original email - cannot be changed
    phone: oldUser.phone, // Keep original phone - cannot be changed
    status: document.getElementById('edit-user-status').value
  };

  // Also update the role if the user is being edited (for admins)
  if (document.getElementById('edit-user-role')) {
    updatedUser.role = document.getElementById('edit-user-role').value;
  }

  // Update local data immediately for instant UI feedback
  allData[userIndex] = updatedUser;
  
  // Rebuild user index if username changed (email stays same)
  if (oldUser.username !== updatedUser.username) {
    // Username changed but email remains same in index
  }

  // Try to sync with backend (non-blocking)
  let result = { isOk: true };
  if (window.dataSdk && window.dataSdk.update) {
    try {
      result = await window.dataSdk.update(updatedUser);
    }catch(err) {
      console.log('Backend sync error (non-critical):', err);
    }
  }

  if (result.isOk) {
    // Refresh the users table and stats to show updated data
    updateUsersTable();
    updateAllStats();
    
    showToast('User updated successfully!', '✅');
  } else {
    // Even if backend fails, show success since local update worked
    updateUsersTable();
    updateAllStats();
    showToast('User updated successfully!', '✅');
  }
  hideModal();
}

// Toggle Login Dropdown
function toggleLoginDropdown() {
  const dropdown = document.getElementById('login-dropdown');
  if (dropdown) {
    dropdown.classList.toggle('hidden');
  }
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('login-dropdown');
  const loginButton = document.querySelector('button[onclick="toggleLoginDropdown()"]');
  
  if (dropdown && !dropdown.classList.contains('hidden')) {
    if (loginButton && !loginButton.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  }
});

// Notification Toggle
function toggleNotification() {
  const panel = document.getElementById('notification-panel');
  if (panel) {
    panel.classList.toggle('hidden');
    // Update notifications when panel is opened
    if (!panel.classList.contains('hidden')) {
      updateNotifications();
    }
  }
}

// Update notifications with dynamic data and date/time
function updateNotifications() {
  const notificationListBody = document.getElementById('notification-list-body');
  const homeMarquee = document.getElementById('home-notification-marquee');
  const dateElement = document.getElementById('notification-date');
  
  // Check if we have the home page notification elements
  if (!homeMarquee) return;
  
  // Get current date and day
  const now = new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  
  const currentDay = days[now.getDay()];
  const currentDate = now.getDate();
  const currentMonth = months[now.getMonth()];
  const currentYear = now.getFullYear();
  const hours = now.getHours();
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  
  const formattedDate = `${currentDay}, ${currentMonth} ${currentDate}, ${currentYear}`;
  const formattedTime = `${displayHours}:${minutes} ${ampm}`;
  
  // Update date display
  if (dateElement) {
    dateElement.textContent = `${formattedDate} • ${formattedTime}`;
  }
  
  // Generate dynamic notifications based on current prices
  const commodities = ['Maize', 'Paddy', 'Wheat', 'Sugarcane'];
  const icons = ['📈', '⚡', '🎯', '📊'];
  
  let notificationsHTML = '';
  
  commodities.forEach((commodity, index) => {
    const basePrice = basePrices[commodity] || 2000;
    // Add slight variation based on current time for dynamic display
    const timeVariation = Math.floor((now.getTime() / 100000) % 100) - 50;
    const currentPrice = Math.round(basePrice + timeVariation);
    
    // Calculate price change percentage
    const priceChange = ((timeVariation / basePrice) * 100).toFixed(1);
    const isPositive = timeVariation >= 0;
    const changeText = isPositive ? `+${priceChange}%` : `${priceChange}%`;
    
    // Generate contextual message based on commodity
    let message, alertType;
    switch(commodity) {
      case 'Maize':
        message = isPositive ? 'Prices up in Kolar market' : 'Prices slightly down today';
        alertType = 'Surge Alert';
        break;
      case 'Paddy':
        message = 'Consistent prices across districts';
        alertType = 'Stable Market';
        break;
      case 'Wheat':
        message = isPositive ? 'Demand increasing this week' : 'Market stabilizing';
        alertType = 'Demand Update';
        break;
      case 'Sugarcane':
        message = 'Steady demand in all markets';
        alertType = 'Market Update';
        break;
    }
    
    const timestamp = `${displayHours}:${minutes} ${ampm}`;
    
    notificationsHTML += `
      <div class="p-4 bg-white bg-opacity-10 rounded-xl border border-white border-opacity-20">
        <div class="flex items-start gap-3">
          <span class="text-2xl">${icons[index]}</span>
          <div class="flex-1">
            <div class="flex items-center justify-between">
              <p class="text-white font-semibold text-sm">${commodity} ${alertType}</p>
              <span class="text-emerald-300 text-xs">${timestamp}</span>
            </div>
            <p class="text-emerald-100 text-xs">${message}</p>
            <p class="text-emerald-200 text-xs mt-2">
              Current: ₹${currentPrice.toLocaleString()}/quintal 
              <span class="${isPositive ? 'text-green-300' : 'text-red-300'}">(${changeText})</span>
            </p>
          </div>
        </div>
      </div>
    `;
  });
  
notificationListBody.innerHTML = notificationsHTML;
  
  // Also update the marquee for home page inline notifications
  if (homeMarquee) {
    homeMarquee.innerHTML = notificationsHTML;
  }
  
  // Also update notification-list-body if it exists
  if (notificationListBody && !homeMarquee) {
    notificationListBody.innerHTML = notificationsHTML;
  }
}

// Close notification when clicking outside
document.addEventListener('click', (e) => {
  const notificationIcon = document.getElementById('notification-icon');
  const notificationPanel = document.getElementById('notification-panel');
  
  if (notificationIcon && notificationPanel && 
      !notificationIcon.contains(e.target) && 
      !notificationPanel.contains(e.target)) {
    notificationPanel.classList.add('hidden');
  }
});

// Toast Notification
function showToast(message, icon = '✅') {
  const toast = document.getElementById('toast');
  document.getElementById('toast-message').textContent = message;
  document.getElementById('toast-icon').textContent = icon;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3000);
}

// Close modal on overlay click
document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) hideModal();
});

// Password Visibility Toggle Function
function togglePasswordVisibility(inputId, eyeIconId) {
  const passwordInput = document.getElementById(inputId);
  const eyeIcon = document.getElementById(eyeIconId);
  
  if (passwordInput && eyeIcon) {
    if (passwordInput.type === 'password') {
      passwordInput.type = 'text';
      eyeIcon.textContent = '🔒';
    } else {
      passwordInput.type = 'password';
      eyeIcon.textContent = '👁️';
    }
  }
}

// Initialize App - Optimized for faster page load
async function initApp() {
  // Immediately show home page for fast perceived performance
  // Don't wait for heavy initialization
  
  // Step 1: Load activities from localStorage (fast, cached)
  loadActivitiesFromLocalStorage();
  
  // Step 2: Show home page immediately (no waiting)
  showPage('home');
  
  // Step 3: Hide loading screen immediately
  document.getElementById('loading-screen').classList.add('hidden');
  
  // Step 4: Defer all heavy operations to run in background (non-blocking)
  
  // Defer SDK initialization (non-critical)
  setTimeout(() => {
    initElementSdk().catch(() => {});
    initDataSdk().catch(() => {});
  }, 500);
  
  // Defer notifications update (not critical for initial render)
  setTimeout(() => {
    try {
      updateNotifications();
    } catch(e) {}
  }, 100);
  
  // Defer heavy operations even further
  setTimeout(() => {
    // Rebuild user index for fast lookups
    try {
      rebuildUserIndex();
    } catch(e) {}
    
    // Update stats in background
    try {
      updateAllStats();
    } catch(e) {}
    
    // Sync pending remarks/complaints to server
    try {
      syncPendingRemarks();
    } catch(e) {}
    
    // Setup dark theme toggle (must be done but can be deferred slightly)
    const darkThemeToggle = document.getElementById('dark-theme-toggle');
    if (darkThemeToggle) {
      darkThemeToggle.addEventListener('change', (e) => {
        const settingsSection = document.getElementById('user-section-settings');
        if (e.target.checked) {
          settingsSection.style.background = 'linear-gradient(135deg, #1f2937 0%, #111827 100%)';
          settingsSection.classList.remove('text-gray-800');
        } else {
          settingsSection.style.background = 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)';
        }
      });
    }
  }, 300);
}

// Start app immediately without waiting
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  // DOM already loaded, run initApp immediately
  initApp();
}

// Function to update prediction when quantity is changed after prediction
function updatePredictionFromQuantity() {
  const quantityInput = document.getElementById('pred-quantity-after');
  if (!quantityInput) {
    showToast('Please make a prediction first', '⚠️');
    return;
  }
  
  const newQuantity = parseInt(quantityInput.value);
  
  // Validate quantity
  if (!newQuantity || newQuantity < 1) {
    showToast('Please enter a valid quantity', '⚠️');
    return;
  }
  
  // Check if we have prediction data stored
  if (!currentPredictionData || !currentPredictionData.currentPrice || !currentPredictionData.predictedPrice) {
    showToast('Please make a prediction first', '⚠️');
    return;
  }
  
  // Get the current prices from stored data
  const currentPrice = currentPredictionData.currentPrice;
  const predictedPrice = currentPredictionData.predictedPrice;
  const priceSource = currentPredictionData.priceSource || 'historical_dataset';
  
  // Calculate new totals based on the new quantity
  const currentTotal = currentPrice * newQuantity;
  const predictedTotal = predictedPrice * newQuantity;
  
  // Update the current prediction data with new quantity
  currentPredictionData.quantity = newQuantity;
  
  // Update the DOM with new totals including source indicator
  const currentPriceTotal = document.getElementById('current-price-total');
  const predictedPriceTotal = document.getElementById('predicted-price-total');
  
  if (currentPriceTotal && predictedPriceTotal) {
    // Show source indicator
    const sourceIcon = priceSource === 'live_api' ? '🔴' : '📊';
    const sourceText = priceSource === 'live_api' ? 'Live' : 'Historical';
    const sourceClass = priceSource === 'live_api' ? 'text-green-600' : 'text-yellow-600';
    
    currentPriceTotal.innerHTML = `Total: ₹${currentTotal.toLocaleString()} (${newQuantity} qtl) <span class="text-xs ml-2 ${sourceClass}">${sourceIcon} ${sourceText}</span>`;
    predictedPriceTotal.textContent = `Total: ₹${predictedTotal.toLocaleString()} (${newQuantity} qtl)`;
    currentPriceTotal.classList.remove('hidden');
    predictedPriceTotal.classList.remove('hidden');
  }
  
  // Show success notification
  showToast(`Price updated for ${newQuantity} quintals`, '🔄');
}

// ============================================
// COMPLAINT FUNCTIONALITY
// ============================================

// Sync pending remarks/complaints to server - runs on app init and periodically
async function syncPendingRemarks() {
  // Sync pending complaints
  try {
    const pendingComplaints = JSON.parse(localStorage.getItem('pending_complaints') || '[]');
    if (pendingComplaints.length > 0) {
      console.log(`Syncing ${pendingComplaints.length} pending complaints...`);
      for (const complaint of pendingComplaints) {
        try {
          const response = await fetch('/api/remarks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(complaint)
          });
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              // Remove from pending queue
              const index = pendingComplaints.findIndex(c => c.sync_id === complaint.sync_id);
              if (index > -1) {
                pendingComplaints.splice(index, 1);
              }
            }
          }
        } catch (e) {
          console.log('Failed to sync complaint:', e);
        }
      }
      localStorage.setItem('pending_complaints', JSON.stringify(pendingComplaints));
    }
  } catch (e) {
    console.error('Error syncing complaints:', e);
  }

  // Sync pending remarks
  try {
    const pendingRemarks = JSON.parse(localStorage.getItem('pending_remarks') || '[]');
    if (pendingRemarks.length > 0) {
      console.log(`Syncing ${pendingRemarks.length} pending remarks...`);
      for (const remark of pendingRemarks) {
        try {
          const response = await fetch('/api/remarks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(remark)
          });
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              // Remove from pending queue
              const index = pendingRemarks.findIndex(r => r.sync_id === remark.sync_id);
              if (index > -1) {
                pendingRemarks.splice(index, 1);
              }
            }
          }
        } catch (e) {
          console.log('Failed to sync remark:', e);
        }
      }
      localStorage.setItem('pending_remarks', JSON.stringify(pendingRemarks));
    }
  } catch (e) {
    console.error('Error syncing remarks:', e);
  }
}

// Submit Complaint Function - Called from user dashboard
function submitComplaint() {
  const commodity = document.getElementById('search-commodity').value;
  const district = document.getElementById('search-district').value;
  const market = document.getElementById('search-market').value;
  const quantity = document.getElementById('search-quantity').value;
  const complaint = document.getElementById('search-complaint').value;
  
  if (!complaint || !complaint.trim()) {
    showToast('Please enter a complaint', '⚠️');
    return;
  }
  
  if (!commodity) {
    showToast('Please select a commodity first', '⚠️');
    return;
  }
  
  // Prepare the data with complaint_type = 'complaint'
  const complaintData = {
    commodity: commodity,
    district: district || 'Kolar',
    market: market || 'Main Market',
    quantity: quantity || 1,
    remark: complaint,
    complaint_type: 'complaint',
    user_id: currentUser?.id || null,
    username: currentUser?.username || 'Anonymous'
  };
  
  // Show loading indicator
  const submitBtn = document.querySelector('button[onclick="submitComplaint()"]');
  const originalText = submitBtn ? submitBtn.innerHTML : 'Submit ⚠️';
  if (submitBtn) {
    submitBtn.innerHTML = 'Submitting...';
    submitBtn.disabled = true;
  }
  
  // STEP 1: Always save to localStorage FIRST (for offline support)
  const syncId = Date.now();
  complaintData.sync_id = syncId;
  complaintData.created_at = new Date().toISOString();
  
  try {
    const pendingComplaints = JSON.parse(localStorage.getItem('pending_complaints') || '[]');
    pendingComplaints.unshift(complaintData);
    localStorage.setItem('pending_complaints', JSON.stringify(pendingComplaints));
    
    // Also add to allData for immediate display
    allData.push({
      type: 'remark',
      ...complaintData,
      local_only: true,
      pending_sync: true
    });
    
    // Show immediate feedback to user
    showToast('Complaint saved! Syncing with server...', '💾');
    document.getElementById('search-complaint').value = '';
    loadUserComplaints();
  } catch (e) {
    console.error('Error saving complaint locally:', e);
  }
  
  // STEP 2: Try to send to server in the background
  fetch('/api/remarks', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(complaintData)
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  })
  .then(data => {
    if (data.success) {
      // Server accepted - remove from pending queue
      try {
        const pendingComplaints = JSON.parse(localStorage.getItem('pending_complaints') || '[]');
        const index = pendingComplaints.findIndex(c => c.sync_id === syncId);
        if (index > -1) {
          pendingComplaints.splice(index, 1);
          localStorage.setItem('pending_complaints', JSON.stringify(pendingComplaints));
        }
        
        // Update local data to mark as synced
        const localIndex = allData.findIndex(d => d.sync_id === syncId);
        if (localIndex > -1) {
          allData[localIndex].pending_sync = false;
          allData[localIndex].local_only = false;
        }
      } catch (e) {
        console.error('Error updating local complaint status:', e);
      }
      
      showToast('Complaint submitted successfully! Admin will review it.', '✅');
    } else {
      // Server returned error but data is already saved locally
      showToast('Complaint saved locally. Will sync when server is available.', '⚠️');
    }
  })
  .catch(error => {
    console.error('Error submitting complaint:', error);
    // Already saved locally - no additional action needed
    showToast('Complaint saved locally. Will sync when server is available.', '⚠️');
  })
  .finally(() => {
    // Restore button state
    if (submitBtn) {
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }
  });
}

// Submit Remark Function - Called from user dashboard
function submitRemark() {
  const commodity = document.getElementById('search-commodity').value;
  const district = document.getElementById('search-district').value;
  const market = document.getElementById('search-market').value;
  const quantity = document.getElementById('search-quantity').value;
  const remark = document.getElementById('search-remarks').value;
  
  if (!remark || !remark.trim()) {
    showToast('Please enter a remark', '⚠️');
    return;
  }
  
  if (!commodity) {
    showToast('Please select a commodity first', '⚠️');
    return;
  }
  
  // Prepare the data with complaint_type = 'remark'
  const remarkData = {
    commodity: commodity,
    district: district || 'Kolar',
    market: market || 'Main Market',
    quantity: quantity || 1,
    remark: remark,
    complaint_type: 'remark',
    user_id: currentUser?.id || null,
    username: currentUser?.username || 'Anonymous'
  };
  
  // Show loading indicator
  const submitBtn = document.querySelector('button[onclick="submitRemark()"]');
  const originalText = submitBtn ? submitBtn.innerHTML : 'Submit 📝';
  if (submitBtn) {
    submitBtn.innerHTML = 'Submitting...';
    submitBtn.disabled = true;
  }
  
  // STEP 1: Always save to localStorage FIRST (for offline support)
  const syncId = Date.now();
  remarkData.sync_id = syncId;
  remarkData.created_at = new Date().toISOString();
  
  try {
    const pendingRemarks = JSON.parse(localStorage.getItem('pending_remarks') || '[]');
    pendingRemarks.unshift(remarkData);
    localStorage.setItem('pending_remarks', JSON.stringify(pendingRemarks));
    
    // Also add to allData for immediate display
    allData.push({
      type: 'remark',
      ...remarkData,
      local_only: true,
      pending_sync: true
    });
    
    // Show immediate feedback to user
    showToast('Remark saved! Syncing with server...', '💾');
    document.getElementById('search-remarks').value = '';
  } catch (e) {
    console.error('Error saving remark locally:', e);
  }
  
  // STEP 2: Try to send to server in the background
  fetch('/api/remarks', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(remarkData)
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  })
  .then(data => {
    if (data.success) {
      // Server accepted - remove from pending queue
      try {
        const pendingRemarks = JSON.parse(localStorage.getItem('pending_remarks') || '[]');
        const index = pendingRemarks.findIndex(r => r.sync_id === syncId);
        if (index > -1) {
          pendingRemarks.splice(index, 1);
          localStorage.setItem('pending_remarks', JSON.stringify(pendingRemarks));
        }
        
        // Update local data to mark as synced
        const localIndex = allData.findIndex(d => d.sync_id === syncId);
        if (localIndex > -1) {
          allData[localIndex].pending_sync = false;
          allData[localIndex].local_only = false;
        }
      } catch (e) {
        console.error('Error updating local remark status:', e);
      }
      
      showToast('Remark submitted successfully!', '✅');
    } else {
      // Server returned error but data is already saved locally
      showToast('Remark saved locally. Will sync when server is available.', '⚠️');
    }
  })
  .catch(error => {
    console.error('Error submitting remark:', error);
    // Already saved locally - no additional action needed
    showToast('Remark saved locally. Will sync when server is available.', '⚠️');
  })
  .finally(() => {
    // Restore button state
    if (submitBtn) {
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }
  });
}

// Load User Complaints Function - Called from user dashboard to view their complaints and responses
function loadUserComplaints() {
  const complaintsList = document.getElementById('user-complaints-list');
  
  if (!complaintsList) return;
  
  // Show loading state
  complaintsList.innerHTML = '<p class="text-gray-500 text-sm text-center py-4">Loading your complaints...</p>';
  
  // user's complaints from API - try both user Fetch_id and __backendId
  let userId = currentUser?.id;
  
  // If id is not available, try __backendId
  if (!userId && currentUser?.__backendId) {
    userId = currentUser.__backendId;
  }
  
  // Also check if there's a backend id stored in localStorage for this user
  if (!userId) {
    // Try to get user from localStorage by comparing email
    const storedUsers = JSON.parse(localStorage.getItem('agripredict_users') || '[]');
    if (storedUsers.length > 0 && currentUser?.email) {
      const matchedUser = storedUsers.find(u => u.email === currentUser.email);
      if (matchedUser) {
        userId = matchedUser.id || matchedUser.__backendId;
      }
    }
  }
  
  if (!userId) {
    complaintsList.innerHTML = '<p class="text-gray-500 text-sm text-center py-4">Please login to view your complaints.</p>';
    return;
  }
  
  // Get username for fallback lookup
  const username = currentUser?.username || '';
  
  // Fetch all complaints (both pending and responded) from the API
  // Pass username as fallback in case user_id doesn't match
  fetch(`/api/user/complaints?user_id=${userId}&username=${encodeURIComponent(username)}&show_all=true`)
    .then(response => response.json())
    .then(data => {
      if (data.success && data.complaints && data.complaints.length > 0) {
        // Render complaints - showing both pending and responded
        complaintsList.innerHTML = data.complaints.map(complaint => {
          const date = complaint.created_at ? new Date(complaint.created_at).toLocaleString() : 'Unknown date';
          
          // Check if there's an admin response
          const hasResponse = complaint.admin_response && complaint.admin_response.trim();
          const responseDate = complaint.response_date ? new Date(complaint.response_date).toLocaleString() : '';
          
          // Determine status badge
          const statusBadge = hasResponse 
            ? '<span class="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-medium">✓ Responded</span>'
            : '<span class="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">⏳ Pending</span>';
          
          return `
            <div class="p-4 bg-gray-50 rounded-xl border-l-4 ${hasResponse ? 'border-emerald-500' : 'border-yellow-500'}">
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <div class="flex items-center gap-2 mb-2">
                    <span class="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">Complaint</span>
                    ${statusBadge}
                    <span class="text-gray-500 text-xs">${date}</span>
                  </div>
                  <p class="text-gray-800 text-sm mb-2">${complaint.remark}</p>
                  <p class="text-gray-500 text-xs">${complaint.commodity || 'N/A'} • ${complaint.district || 'Kolar'} • ${complaint.market || 'Main Market'}</p>
                </div>
                <span class="text-lg">${hasResponse ? '✅' : '⏳'}</span>
              </div>
              ${hasResponse ? `
                <div class="mt-3 pt-3 border-t border-gray-200">
                  <div class="flex items-start gap-2">
                    <span class="text-lg">💬</span>
                    <div>
                      <div class="flex items-center gap-2 mb-1">
                        <span class="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-medium">Admin Response</span>
                        ${responseDate ? `<span class="text-gray-500 text-xs">${responseDate}</span>` : ''}
                      </div>
                      <p class="text-gray-700 text-sm">${complaint.admin_response}</p>
                    </div>
                  </div>
                </div>
              ` : `
                <div class="mt-3 pt-3 border-t border-gray-200">
                  <p class="text-gray-500 text-sm italic">Admin will review your complaint soon. Please check back later for updates.</p>
                </div>
              `}
            </div>
          `;
        }).join('');
      } else {
        // No complaints found
        complaintsList.innerHTML = '<p class="text-gray-500 text-sm text-center py-4">No complaints submitted yet. Your complaint responses will appear here after admin reviews them.</p>';
      }
    })
    .catch(error => {
      console.error('Error loading user complaints:', error);
      complaintsList.innerHTML = '<p class="text-gray-500 text-sm text-center py-4">Error loading complaints. Please try again later.</p>';
    });
}

// Respond to Complaint Function - Called from admin dashboard
function respondToComplaint(complaintId) {
  // Find the complaint to get current remark
  fetch('/api/admin/remarks')
    .then(response => response.json())
    .then(data => {
      if (data.success && data.remarks) {
        const complaint = data.remarks.find(r => r.id === complaintId);
        if (complaint) {
          // Show response modal
          showModal(`
            <h3 class="text-xl font-bold text-gray-800 mb-4">Respond to Complaint</h3>
            <div class="mb-4 p-3 bg-gray-50 rounded-xl">
              <p class="text-gray-600 text-sm mb-1"><strong>User:</strong> ${complaint.username || 'Unknown'}</p>
              <p class="text-gray-600 text-sm mb-1"><strong>Commodity:</strong> ${complaint.commodity}</p>
              <p class="text-gray-800 text-sm mt-2"><strong>Complaint:</strong> ${complaint.remark}</p>
            </div>
            <form onsubmit="sendComplaintResponse(event, ${complaintId})">
              <div class="mb-4">
                <label class="block text-gray-700 font-medium mb-2">Your Response Message</label>
                <textarea id="admin-response" rows="4" required class="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-emerald-500" placeholder="Write user... your response to the e.g., 'We have reviewed your complaint and...'"></textarea>
              </div>
              <div class="flex gap-3">
                <button type="button" onclick="hideModal()" class="flex-1 py-3 border-2 border-gray-300 text-gray-600 rounded-xl font-bold hover:bg-gray-50">Cancel</button>
                <button type="submit" class="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700">Send Response ✅</button>
              </div>
            </form>
          `);
        }
      }
    })
    .catch(error => {
      console.error('Error fetching complaint details:', error);
      showToast('Error loading complaint details', '❌');
    });
}

// Send Complaint Response - Submit admin's response to complaint
function sendComplaintResponse(e, complaintId) {
  e.preventDefault();
  const response = document.getElementById('admin-response').value;
  
  if (!response || !response.trim()) {
    showToast('Please enter a response message', '⚠️');
    return;
  }
  
  // Call API to submit response
  fetch('/api/admin/respond-complaint', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      complaint_id: complaintId,
      admin_response: response
    })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      showToast('Response sent to user successfully!', '✅');
      hideModal();
      // Reload remarks in admin panel
      loadRemarks();
    } else {
      showToast(data.message || 'Failed to send response', '❌');
    }
  })
  .catch(error => {
    console.error('Error sending response:', error);
    showToast('Error sending response. Please try again.', '❌');
  });
}

// Update the loadRemarks function to include complaint type and response option
// Also load remarks from localStorage when backend is unavailable
function loadRemarks() {
  const remarksList = document.getElementById('remarks-list');
  const remarksCount = document.getElementById('remarks-count');
  
  if (!remarksList) return;
  
  // Show loading state
  remarksList.innerHTML = '<div class="p-3 bg-white bg-opacity-10 rounded-xl"><span class="text-white text-sm">Loading remarks...</span></div>';
  
  // First, try to fetch from API
  fetch('/api/admin/remarks')
    .then(response => response.json())
    .then(data => {
      // Get local remarks as fallback/backup
      let localRemarks = [];
      try {
        const storedLocalRemarks = localStorage.getItem('local_remarks');
        if (storedLocalRemarks) {
          localRemarks = JSON.parse(storedLocalRemarks);
        }
      } catch (e) {
        console.log('Error loading local remarks:', e);
      }
      
      // Combine API remarks and local remarks (avoid duplicates by ID)
      let allRemarks = [];
      
      // Add API remarks if available - FILTER OUT COMPLAINTS (only show remarks)
      if (data.success && data.remarks && data.remarks.length > 0) {
        allRemarks = [...data.remarks].filter(r => r.complaint_type !== 'complaint');
      }
      
      // Add local remarks that don't exist in API remarks - FILTER OUT COMPLAINTS
      if (localRemarks.length > 0) {
        const apiIds = new Set(allRemarks.map(r => r.id));
        localRemarks.forEach(localR => {
          // For local remarks without backend ID, check by other fields - filter out complaints
          const exists = allRemarks.some(r => 
            (r.id === localR.id) || 
            (r.remark === localR.remark && r.commodity === localR.commodity && r.created_at === localR.created_at)
          );
          if (!exists && localR.complaint_type !== 'complaint') {
            allRemarks.push({
              ...localR,
              is_local: true // Flag to indicate this is from local storage
            });
          }
        });
      }
      
      // Sort by created_at descending
      allRemarks.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      if (allRemarks.length > 0) {
        // Render remarks - separate complaints and regular remarks
        remarksList.innerHTML = allRemarks.map(remark => {
          const date = remark.created_at ? new Date(remark.created_at).toLocaleString() : 'Unknown date';
          const isComplaint = remark.complaint_type === 'complaint';
          const hasResponse = remark.admin_response && remark.admin_response.trim();
          const isLocal = remark.is_local || remark.local_only;
          
          if (isComplaint) {
            // Render complaint with respond button if not responded yet
            return `
              <div class="p-3 bg-white bg-opacity-10 rounded-xl">
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <div class="flex items-center gap-2 mb-1">
                      <span class="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">Complaint</span>
                      ${hasResponse ? '<span class="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">Responded</span>' : ''}
                      ${isLocal ? '<span class="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">Pending Sync</span>' : ''}
                    </div>
                    <p class="text-white text-sm"><strong>${remark.username || 'User'}</strong>: ${remark.remark}</p>
                    <p class="text-purple-300 text-xs mt-1">${remark.commodity} • ${remark.district || 'Kolar'} • ${remark.market || 'Main Market'}</p>
                    <p class="text-gray-400 text-xs">${date}</p>
                    ${hasResponse ? `
                      <div class="mt-2 pt-2 border-t border-white border-opacity-20">
                        <p class="text-emerald-300 text-xs"><strong>Your Response:</strong> ${remark.admin_response}</p>
                      </div>
                    ` : ''}
                  </div>
                  <div class="flex flex-col gap-2">
                    <span class="text-lg">⚠️</span>
                    ${!hasResponse ? `
                      <button onclick="respondToComplaint(${remark.id})" class="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-500">Respond</button>
                    ` : ''}
                  </div>
                </div>
              </div>
            `;
          } else {
            // Regular remark
            return `
              <div class="p-3 bg-white bg-opacity-10 rounded-xl">
                <div class="flex items-start justify-between">
                  <div>
                    <div class="flex items-center gap-2 mb-1">
                      <span class="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium">Remark</span>
                      ${isLocal ? '<span class="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">Pending Sync</span>' : ''}
                    </div>
                    <p class="text-white text-sm"><strong>${remark.username || 'User'}</strong>: ${remark.remark}</p>
                    <p class="text-purple-300 text-xs mt-1">${remark.commodity} • ${remark.district || 'Kolar'} • ${remark.market || 'Main Market'}</p>
                    <p class="text-gray-400 text-xs">${date}</p>
                  </div>
<span class="text-lg">📝</span>
              </div>
            `;
          }
        }).join('');
        
        // Update count
        if (remarksCount) {
          const complaintCount = allRemarks.filter(r => r.complaint_type === 'complaint').length;
          const remarkCount = allRemarks.filter(r => r.complaint_type !== 'complaint').length;
          remarksCount.textContent = `Total: ${remarkCount} Remarks`;
        }
      } else {
        // No remarks found
        remarksList.innerHTML = '<div class="p-3 bg-white bg-opacity-10 rounded-xl"><span class="text-white text-sm">No remarks yet. Users can submit remarks from Market Search.</span></div>';
        if (remarksCount) {
          remarksCount.textContent = 'Total: 0 Remarks';
        }
      }
    })
    .catch(error => {
      console.error('Error loading remarks:', error);
      // Try to load from localStorage as fallback
      loadRemarksFromLocalStorage();
    });
}

// Helper function to load remarks purely from localStorage (fallback)
function loadRemarksFromLocalStorage() {
  const remarksList = document.getElementById('remarks-list');
  const remarksCount = document.getElementById('remarks-count');
  
  if (!remarksList) return;
  
  try {
    const localRemarks = JSON.parse(localStorage.getItem('local_remarks') || '[]');
    const localComplaints = JSON.parse(localStorage.getItem('local_complaints') || '[]');
    
    // Combine both
    let allRemarks = [...localRemarks, ...localComplaints];
    
    // Sort by created_at descending
    allRemarks.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    if (allRemarks.length > 0) {
      remarksList.innerHTML = allRemarks.map(remark => {
        const date = remark.created_at ? new Date(remark.created_at).toLocaleString() : 'Unknown date';
        const isComplaint = remark.complaint_type === 'complaint';
        
        return isComplaint ? `
          <div class="p-3 bg-white bg-opacity-10 rounded-xl">
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <span class="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">Complaint</span>
                  <span class="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">Local Only</span>
                </div>
                <p class="text-white text-sm"><strong>${remark.username || 'User'}</strong>: ${remark.remark}</p>
                <p class="text-purple-300 text-xs mt-1">${remark.commodity} • ${remark.district || 'Kolar'} • ${remark.market || 'Main Market'}</p>
                <p class="text-gray-400 text-xs">${date}</p>
              </div>
              <span class="text-lg">⚠️</span>
            </div>
          </div>
        ` : `
          <div class="p-3 bg-white bg-opacity-10 rounded-xl">
            <div class="flex items-start justify-between">
              <div>
                <div class="flex items-center gap-2 mb-1">
                  <span class="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium">Remark</span>
                  <span class="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">Local Only</span>
                </div>
                <p class="text-white text-sm"><strong>${remark.username || 'User'}</strong>: ${remark.remark}</p>
                <p class="text-purple-300 text-xs mt-1">${remark.commodity} • ${remark.district || 'Kolar'} • ${remark.market || 'Main Market'}</p>
                <p class="text-gray-400 text-xs">${date}</p>
              </div>
              <span class="text-lg">📝</span>
            </div>
          </div>
        `;
      }).join('');
      
      if (remarksCount) {
        remarksCount.textContent = `Total: ${allRemarks.length} (from local storage - sync with server needed)`;
      }
    } else {
      remarksList.innerHTML = '<div class="p-3 bg-white bg-opacity-10 rounded-xl"><span class="text-white text-sm">No remarks found</span></div>';
      if (remarksCount) {
        remarksCount.textContent = 'Total: 0 Remarks';
      }
    }
  } catch (e) {
    console.error('Error loading local remarks:', e);
    remarksList.innerHTML = '<div class="p-3 bg-white bg-opacity-10 rounded-xl"><span class="text-white text-sm">Error loading remarks</span></div>';
  }
}

// Load Admin Complaints - Fetch and display complaints in admin Market Center
function loadAdminComplaints() {
  const complaintsList = document.getElementById('admin-complaints-list');
  const complaintsCount = document.getElementById('complaints-count');
  
  if (!complaintsList) return;
  
  // Show loading state
  complaintsList.innerHTML = '<div class="p-3 bg-white bg-opacity-10 rounded-xl"><span class="text-white text-sm">Loading complaints...</span></div>';
  
  // First, get any pending complaints from localStorage (for offline support)
  let localComplaints = [];
  try {
    const pendingComplaints = JSON.parse(localStorage.getItem('pending_complaints') || '[]');
    localComplaints = pendingComplaints.filter(c => c.complaint_type === 'complaint');
  } catch (e) {
    console.log('Error loading local complaints:', e);
  }
  
  // Also check local_complaints storage
  try {
    const localComplaintsStored = JSON.parse(localStorage.getItem('local_complaints') || '[]');
    localComplaints = [...localComplaints, ...localComplaintsStored];
  } catch (e) {
    console.log('Error loading local_complaints:', e);
  }
  
  // Fetch complaints from API
  fetch('/api/admin/complaints')
    .then(response => response.json())
    .then(data => {
      // Combine API complaints and local complaints (avoid duplicates)
      let allComplaints = [];
      
      // Add API complaints if available
      if (data.success && data.complaints && data.complaints.length > 0) {
        allComplaints = [...data.complaints];
      }
      
      // Add local complaints that don't exist in API complaints
      if (localComplaints.length > 0) {
        const apiIds = new Set(allComplaints.map(c => c.id));
        localComplaints.forEach(localC => {
          // For local complaints without backend ID, check by other fields
          const exists = allComplaints.some(c => 
            (c.id === localC.id) || 
            (c.remark === localC.remark && c.commodity === localC.commodity && c.created_at === localC.created_at)
          );
          if (!exists) {
            allComplaints.push({
              ...localC,
              is_local: true,
              username: localC.username || 'Anonymous',
              district: localC.district || 'Kolar',
              market: localC.market || 'Main Market'
            });
          }
        });
      }
      
      // Sort by created_at descending
      allComplaints.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      if (allComplaints.length > 0) {
        // Render complaints
        complaintsList.innerHTML = allComplaints.map(complaint => {
          const date = complaint.created_at ? new Date(complaint.created_at).toLocaleString() : 'Unknown date';
          const hasResponse = complaint.admin_response && complaint.admin_response.trim();
          const isLocal = complaint.is_local || complaint.local_only || complaint.pending_sync;
          
          return `
            <div class="p-3 bg-white bg-opacity-10 rounded-xl">
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">Complaint</span>
                    ${hasResponse ? '<span class="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">Responded</span>' : '<span class="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">Pending</span>'}
                    ${isLocal ? '<span class="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">Local</span>' : ''}
                  </div>
                  <p class="text-white text-sm"><strong>${complaint.username || 'User'}</strong>: ${complaint.remark}</p>
                  <p class="text-purple-300 text-xs mt-1">${complaint.commodity} • ${complaint.district || 'Kolar'} • ${complaint.market || 'Main Market'}</p>
                  <p class="text-gray-400 text-xs">${date}</p>
                  ${hasResponse ? `
                    <div class="mt-2 pt-2 border-t border-white border-opacity-20">
                      <p class="text-emerald-300 text-xs"><strong>Admin Response:</strong> ${complaint.admin_response}</p>
                    </div>
                  ` : ''}
                </div>
                <div class="flex flex-col gap-2">
                  <span class="text-lg">⚠️</span>
                  ${!hasResponse ? `
                    <button onclick="respondToComplaint(${complaint.id || 0})" class="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-500">Respond</button>
                  ` : ''}
                </div>
              </div>
            </div>
          `;
        }).join('');
        
        // Update count
        if (complaintsCount) {
          const respondedCount = allComplaints.filter(c => c.admin_response && c.admin_response.trim()).length;
          const pendingCount = allComplaints.length - respondedCount;
          complaintsCount.textContent = `Total: ${allComplaints.length} Complaints (${pendingCount} Pending, ${respondedCount} Responded)`;
        }
      } else {
        // No complaints found
        complaintsList.innerHTML = '<div class="p-3 bg-white bg-opacity-10 rounded-xl"><span class="text-white text-sm">No complaints yet. Users can submit complaints from Market Search.</span></div>';
        if (complaintsCount) {
          complaintsCount.textContent = 'Total: 0 Complaints';
        }
      }
    })
    .catch(error => {
      console.error('Error loading complaints:', error);
      // If API fails, still show local complaints
      if (localComplaints.length > 0) {
        complaintsList.innerHTML = localComplaints.map(complaint => {
          const date = complaint.created_at ? new Date(complaint.created_at).toLocaleString() : 'Unknown date';
          return `
            <div class="p-3 bg-white bg-opacity-10 rounded-xl">
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">Complaint</span>
                    <span class="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">Pending Sync</span>
                  </div>
                  <p class="text-white text-sm"><strong>${complaint.username || 'User'}</strong>: ${complaint.remark}</p>
                  <p class="text-purple-300 text-xs mt-1">${complaint.commodity} • ${complaint.district || 'Kolar'} • ${complaint.market || 'Main Market'}</p>
                  <p class="text-gray-400 text-xs">${date}</p>
                </div>
                <span class="text-lg">⚠️</span>
              </div>
            </div>
          `;
        }).join('');
        if (complaintsCount) {
          complaintsCount.textContent = `Total: ${localComplaints.length} Complaints (from local storage)`;
        }
      } else {
        complaintsList.innerHTML = '<div class="p-3 bg-white bg-opacity-10 rounded-xl"><span class="text-white text-sm">Error loading complaints. Server may be unavailable.</span></div>';
      }
    });
}



