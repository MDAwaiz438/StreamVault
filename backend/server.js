import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { Readable } from 'stream';
import rateLimit from 'express-rate-limit';
import hd from './src/extractors/hd.js';
import hd1 from './src/extractors/hd1.js';
import hd2 from './src/extractors/hd2.js';
import hd3 from './src/extractors/hd3.js';
import hd4 from './src/extractors/hd4.js';

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5000;

app.use(cors());

// DDoS & Bot Protection: Limit API requests
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limit specifically for the extraction endpoints
const extractionLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 100, // Limit each IP to 100 extraction requests per windowMs
  message: { error: 'Extraction rate limit exceeded.' },
});

app.use('/api/', apiLimiter);

const API_KEY = process.env.API_KEY || 'vidsrc-secure-key-2026';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'vidsrc_super_secret_key_12345678';
const IV_LENGTH = 16;

const extractors = {
  hd,
  hd1,
  hd2,
  hd3,
  hd4
};

function encryptURL(text) {
  let iv = crypto.randomBytes(IV_LENGTH);
  let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + encrypted.toString('hex');
}

function decryptURL(token) {
  try {
    let ivHex = token.substring(0, 32);
    let encHex = token.substring(32);
    let iv = Buffer.from(ivHex, 'hex');
    let encryptedTextBuffer = Buffer.from(encHex, 'hex');
    let decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedTextBuffer);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('utf8');
  } catch (e) {
    return null;
  }
}

const cache = new Map();

function cleanCache() {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > 2 * 60 * 60 * 1000) cache.delete(key);
  }
}

function botBlocker(req, isProxy = false) {
  const ua = req.headers['user-agent'] || '';
  const isBot = /HeadlessChrome|PhantomJS|Puppeteer|Selenium|Playwright|curl|wget|bot|spider|scraper/i.test(ua);
  
  if (isBot) {
    console.warn(`[SECURITY] Bot detected and blocked (UA: ${ua})`);
    return true;
  }
  return false;
}

// Extract endpoint
app.get('/api/extract', extractionLimiter, async (req, res) => {
  if (botBlocker(req)) {
    return res.status(403).json({ error: 'Access Denied: Automated scraping detected' });
  }

  const providedKey = req.headers['x-api-key'] || req.query.apiKey;
  if (!providedKey || providedKey !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
  }

  const { tmdbId, server, type = 'movie', s = '1', e = '1', advLang, advSub, nocache } = req.query;

  if (!/^\d+$/.test(tmdbId)) return res.status(400).json({ error: 'Invalid tmdbId format' });
  if (type !== 'movie' && type !== 'tv') return res.status(400).json({ error: 'Invalid type' });
  if (typeof server !== 'string' || server.length > 20) return res.status(400).json({ error: 'Invalid server' });

  cleanCache();
  const cacheKey = `${server}_${type}_${tmdbId}_${s}_${e}_${advLang || ''}_${advSub || ''}`;
  
  if (nocache !== 'true' && cache.has(cacheKey)) {
    console.log(`[CACHE HIT] Returning cached stream for ${cacheKey}`);
    const cachedData = cache.get(cacheKey);
    return res.json({ 
      encryptedStream: encryptURL(cachedData.url), 
      cached: true,
      isMp4: cachedData.url.includes('.mp4')
    });
  }

  console.log(`[EXTRACTION] Starting extraction for ${cacheKey}...`);

  let headersSent = false;
  const fallback = setTimeout(() => {
    if (!headersSent) {
      headersSent = true;
      res.status(404).json({ error: 'Server took too long' });
    }
  }, 115000);

  // Mock res wrapper to prevent multiple responses
  const mockRes = {
    get headersSent() { return headersSent; },
    status: (code) => ({
      json: (data) => {
        if (headersSent) return;
        headersSent = true;
        clearTimeout(fallback);
        res.status(code).json(data);
      }
    }),
    json: (data) => {
      if (headersSent) return;
      headersSent = true;
      clearTimeout(fallback);
      res.json(data);
    }
  };

  const args = { tmdbId, type, s, e, req: { query: req.query }, res: mockRes, cache, cacheKey, encryptURL, fallback, server };

  try {
    const extractor = await import(`./src/extractors/${server}.js`);
    extractor.default.extract(args);
  } catch (err) {
    if (!headersSent) {
      headersSent = true;
      clearTimeout(fallback);
      console.error(`[EXTRACTION] Error loading extractor ${server}:`, err);
      res.status(404).json({ error: `Server ${server} not found or failed to load` });
    }
  }
});

// Unified JSON API Endpoints
async function extractUnified(req, res, type) {
  if (botBlocker(req)) {
    return res.status(403).json({ error: 'Access Denied: Automated scraping detected' });
  }

  const { tmdbId, s = '1', e = '1' } = req.params;
  const { advLang, advSub } = req.query;
  const providedKey = req.headers['x-api-key'] || req.query.apiKey;
  
  if (!providedKey || providedKey !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
  }

  if (!/^\d+$/.test(tmdbId)) return res.status(400).json({ error: 'Invalid tmdbId format' });

  const serversToTry = Object.keys(extractors);
  console.log(`[UNIFIED API] Fetching ${type} ${tmdbId} across ${serversToTry.length} servers...`);

  const results = await Promise.allSettled(serversToTry.map(server => {
    return new Promise(async (resolve) => {
      let responded = false;
      const fallbackTimer = setTimeout(() => {
        if (!responded) { responded = true; resolve({ server, success: false, error: 'Timeout' }); }
      }, 15000);

      const mockRes = {
        get headersSent() { return responded; },
        status: (code) => ({
          json: (data) => {
            if (responded) return;
            responded = true;
            clearTimeout(fallbackTimer);
            if (code >= 400 || data.error) resolve({ server, success: false, error: data.error || 'Failed' });
            else resolve({ server, success: true, data });
          }
        }),
        json: (data) => {
          if (responded) return;
          responded = true;
          clearTimeout(fallbackTimer);
          if (data.error) resolve({ server, success: false, error: data.error });
          else resolve({ server, success: true, data });
        }
      };

      const cacheKey = `${server}_${type}_${tmdbId}_${s}_${e}_${advLang || ''}_${advSub || ''}`;
      if (req.query.nocache !== 'true' && cache.has(cacheKey)) {
        clearTimeout(fallbackTimer);
        responded = true;
        const cachedData = cache.get(cacheKey);
        return resolve({ server, success: true, data: { encryptedStream: encryptURL(cachedData.url), streamUrl: cachedData.url, cached: true, isMp4: cachedData.url.includes('.mp4') } });
      }

      const args = { tmdbId, type, s, e, req: { query: req.query }, res: mockRes, cache, cacheKey, encryptURL, fallback: fallbackTimer, server };
      try {
        const extractor = extractors[server];
        if (extractor && typeof extractor.extract === 'function') {
           extractor.extract(args);
        } else {
           if (!responded) { responded = true; clearTimeout(fallbackTimer); resolve({ server, success: false, error: 'Extractor not valid' }); }
        }
      } catch (e) {
        if (!responded) {
          responded = true;
          clearTimeout(fallbackTimer);
          resolve({ server, success: false, error: e.message });
        }
      }
    });
  }));

  const successfulStreams = results
    .filter(r => r.status === 'fulfilled' && r.value.success)
    .map(r => ({ server: r.value.server, ...r.value.data }));

  const failedStreams = results
    .filter(r => r.status === 'fulfilled' && !r.value.success)
    .map(r => ({ server: r.value.server, error: r.value.error }));

  res.json({
    tmdbId,
    type,
    streams: successfulStreams,
    failed: failedStreams
  });
}

app.get('/api/v1/movie/:tmdbId', extractionLimiter, (req, res) => extractUnified(req, res, 'movie'));
app.get('/api/v1/tv/:tmdbId/:s/:e', extractionLimiter, (req, res) => extractUnified(req, res, 'tv'));


// Proxy endpoint with encrypted token
app.get('/api/play/:token', async (req, res) => {
  if (botBlocker(req, true)) {
    return res.status(403).send('Access Denied: Automated scraping detected');
  }

  const token = req.params.token;
  let url = decryptURL(token);
  if (!url) return res.status(400).send('Invalid or expired token');
  
  if (url.startsWith('http%3A') || url.startsWith('https%3A')) {
    url = decodeURIComponent(url);
  }

  let referer = 'https://player.nhdapi.com/';
  let origin = 'https://player.nhdapi.com';
  let headersObj = {};
  let parsedHeadersParam = req.query.headers;

  try {
    if (parsedHeadersParam) {
      if (typeof parsedHeadersParam === 'string' && parsedHeadersParam.includes('%7B')) {
        parsedHeadersParam = decodeURIComponent(parsedHeadersParam);
      }
      headersObj = JSON.parse(parsedHeadersParam);
      if (headersObj.Referer) referer = headersObj.Referer;
      if (headersObj.Origin) origin = headersObj.Origin;
    }
  } catch (e) {
    console.error('Proxy header parsing error:', e);
  }

  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname;
    
    if (hostname.includes('vodvidl.site') || hostname.includes('stormvv')) {
      referer = 'https://vidlink.pro/';
      origin = 'https://vidlink.pro';
    } else if (hostname.includes('1shows.app')) {
      referer = 'https://cinema.bz/';
      origin = 'https://cinema.bz';
    } else if (hostname.includes('workers.dev')) {
      if (req.query.server === 'cinema') {
        referer = 'https://cinema.bz/';
        origin = 'https://cinema.bz';
      } else {
        referer = 'https://nxsha.space/';
        origin = 'https://nxsha.space';
      }
    } else if (hostname.includes('itsnitrox.tech')) {
      referer = 'https://nxsha.space/';
      origin = 'https://nxsha.space';
    } else if (hostname.includes('hakunaymatata.com')) {
      referer = '';
      origin = '';
    }
  } catch (e) {}

  const fullUa = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.7827.55 Safari/537.36';
  
  const fetchHeaders = { 'User-Agent': fullUa, ...headersObj };
  if (referer) fetchHeaders['Referer'] = referer;
  if (origin) fetchHeaders['Origin'] = origin;
  
  const rangeHeader = req.headers['range'];
  if (rangeHeader) fetchHeaders['Range'] = rangeHeader;
  
    let fetchRes;
    try {
      fetchRes = await fetch(url, {
        headers: fetchHeaders,
        redirect: 'follow'
      });
      
      if (fetchRes.url.includes('cloudflare-terms-of-service-abuse')) {
        return res.status(404).send('Stream restricted by provider');
      }
    } catch (e) {
      console.error('Proxy fetch error:', e.message);
      return res.status(502).send('Bad Gateway');
    }
    
    res.set('Access-Control-Allow-Origin', '*');
    
    const safeHeaders = ['content-type', 'content-length', 'content-range', 'accept-ranges'];
    fetchRes.headers.forEach((val, key) => {
      if (safeHeaders.includes(key.toLowerCase())) {
        res.set(key, val);
      }
    });

    const ct = fetchRes.headers.get('content-type') || '';
    const isPlaylistOrSub = url.includes('.m3u8') || url.includes('.vtt') || ct.includes('mpegurl') || ct.includes('vtt');

    res.status(fetchRes.status);

    if (isPlaylistOrSub) {
      let text = await fetchRes.text();
      const baseUrl = new URL(fetchRes.url); 
      text = text.replace(/^(?!https?:\/\/|#)[^\r\n]+/gm, match => {
         try { return new URL(match, baseUrl).href; } catch(e) { return match; }
      });
      const rewritten = text.replace(/https?:\/\/[^\s\'\"]+/g, m => {
        let encToken = encryptURL(m);
        // Ensure absolute URL so HLS.js requests the chunks from the backend, not the frontend domain
        let proxyBase = `${req.protocol}://${req.get('host')}/api/play/`;
        let proxyUrl = proxyBase + encToken;
        let queryParams = [];
        if (parsedHeadersParam) queryParams.push('headers=' + encodeURIComponent(parsedHeadersParam));
        if (req.query.server) queryParams.push('server=' + encodeURIComponent(req.query.server));
        if (queryParams.length > 0) proxyUrl += '?' + queryParams.join('&');
        return proxyUrl;
      });
      res.send(rewritten);
    } else {
      // Stream for native or chunked download
      if (fetchRes.body) {
        Readable.fromWeb(fetchRes.body).pipe(res);
      } else {
        res.end();
      }
    }
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});