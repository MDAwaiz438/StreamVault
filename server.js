import express from 'express';
import cors from 'cors';
import { exec, spawn } from 'child_process';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';

const app = express();
const PORT = process.env.PORT || 3000;

// Security: CORS
const allowedOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

// Security: Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', apiLimiter);

// Security: Encryption
const ENCRYPTION_KEY = 'vidsrc_super_secret_key_12345678';
const IV_LENGTH = 16;

function encryptURL(text) {
  let iv = crypto.randomBytes(IV_LENGTH);
  let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

app.use(express.static('public'));

const cache = new Map();

// Helper to clear cache items older than 2 hours
function cleanCache() {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > 2 * 60 * 60 * 1000) {
      cache.delete(key);
    }
  }
}

app.get('/api/extract', async (req, res) => {
  // 4. Anti-Hotlinking: Strict Referer Check
  const referer = req.headers.referer || req.headers.origin;
  if (!referer || (!referer.includes('localhost:3000') && !referer.includes('127.0.0.1:3000'))) {
    console.warn(`[SECURITY] Blocked request from invalid referer: ${referer}`);
    return res.status(403).json({ error: 'Access Denied: Invalid Referer' });
  }

  const tmdbId = req.query.tmdbId;
  const server = req.query.server;
  const type = req.query.type || 'movie';
  const s = req.query.s || '1';
  const e = req.query.e || '1';

  if (!tmdbId || !server) {
    return res.status(400).json({error: 'Missing tmdbId or server parameter'});
  }

  // Set a 95s timeout on the whole request since playwright can be slow
  const fallback = setTimeout(() => {
    if (!res.headersSent) res.status(404).json({error: 'Server took too long'});
  }, 120000);

  cleanCache();
  const cacheKey = `${server}_${type}_${tmdbId}_${s}_${e}_${req.query.advLang || ''}_${req.query.advSub || ''}`;
  if (req.query.nocache !== 'true' && cache.has(cacheKey)) {
    console.log(`[CACHE HIT] Returning cached stream for ${cacheKey}`);
    return res.json({ encryptedStream: encryptURL(cache.get(cacheKey).url), cached: true });
  }

  console.log(`[EXTRACTION] Starting extraction for ${cacheKey}...`);

  const args = { tmdbId, type, s, e, req, res, cache, cacheKey, encryptURL, fallback, server };

  try {
    const extractor = await import(`./src/extractors/${server}.js`);
    extractor.default.extract(args);
  } catch (err) {
    clearTimeout(fallback);
    console.error(`[EXTRACTION ERROR] Failed to load extractor for ${server}:`, err);
    if (!res.headersSent) {
      res.status(400).json({error: 'Invalid server specified or extractor not found'});
    }
  }
});

app.get('/proxy', async (req, res) => {
  let url = req.query.url;
  console.log('[PROXY REQUEST]', url);
  if(!url) return res.status(400).send('missing url');
  if (url.startsWith('http%3A') || url.startsWith('https%3A')) {
    url = decodeURIComponent(url);
  }
  
  try{
    let referer = 'https://player.nhdapi.com/';
    let origin = 'https://player.nhdapi.com';
    let headersObj = {};
    let parsedHeadersParam = req.query.headers;

    try {
      
      try {
        const targetUrlObj = new URL(url);
        const embeddedHeaders = targetUrlObj.searchParams.get('headers');
        if (embeddedHeaders) {
           if (!parsedHeadersParam) parsedHeadersParam = embeddedHeaders;
           targetUrlObj.searchParams.delete('headers');
           url = targetUrlObj.toString();
        } else if (url.includes('&headers=')) {
           const parts = url.split('&headers=');
           url = parts[0];
           if (!parsedHeadersParam) parsedHeadersParam = parts[1];
        } else if (url.includes('?headers=')) {
           const parts = url.split('?headers=');
           url = parts[0];
           if (!parsedHeadersParam) parsedHeadersParam = parts[1];
        }
      } catch (e) {
        if (url.includes('&headers=')) {
           const parts = url.split('&headers=');
           url = parts[0];
           if (!parsedHeadersParam) parsedHeadersParam = parts[1];
        }
      }

      if (parsedHeadersParam) {
        if (typeof parsedHeadersParam === 'string' && parsedHeadersParam.includes('%7B')) {
          parsedHeadersParam = decodeURIComponent(parsedHeadersParam);
        }
        headersObj = JSON.parse(parsedHeadersParam);
        if (headersObj.Referer) referer = headersObj.Referer;
        if (headersObj.Origin) origin = headersObj.Origin;
      }
    } catch(e) {
      console.error('Proxy header parsing error:', e);
    }

    try {
      const parsedUrl = new URL(url);
      const hostname = parsedUrl.hostname;
      
      if (hostname.includes('vodvidl.site') || hostname.includes('stormvv')) {
        referer = 'https://vidlink.pro/';
        origin = 'https://vidlink.pro';
      } else if (hostname.includes('workers.dev')) {
        referer = 'https://nxsha.space/';
        origin = 'https://nxsha.space';
      } else if (hostname.includes('hakunaymatata.com')) {
        referer = '';
        origin = '';
      }
    } catch(e) {}
    
    if(!referer && !url.includes('hakunaymatata.com')) referer = 'https://purstream.ch/';
    if(!origin && !url.includes('hakunaymatata.com')) origin = 'https://purstream.ch';
    
    // Origin usually shouldn't have a trailing slash
    if (origin) origin = origin.endsWith('/') ? origin.slice(0, -1) : origin;
    
    const fullUa = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.7827.55 Safari/537.36';
    const usesCloudflareTLS = url.includes('vodvidl.site') || url.includes('stormvv') || url.includes('workers.dev') || url.includes('vidsrc') || url.includes('purstream');
    
    if (usesCloudflareTLS) {
      // Cloudflare TLS-fingerprints Node.js and blocks it.
      // curl has a different TLS fingerprint that Cloudflare accepts.
      const curlArgs = ['-4', '-s', '-L', '-H', `User-Agent: ${fullUa}`, '-H', `Referer: ${referer}`];
      if (req.headers.range) curlArgs.push('-H', `Range: ${req.headers.range}`);
      // Pass -i to get response headers, then we parse them
      curlArgs.push('-D', '-'); // dump headers to stdout before body
      curlArgs.push(url);
      
      console.log('Spawning curl with args:', curlArgs);
      const curl = spawn('curl.exe', curlArgs);
      let headersDone = false;
      let headerBuf = Buffer.alloc(0);
      let bodyBuf = Buffer.alloc(0);
      let isPlaylistOrSub = url.includes('.m3u8') || url.includes('.vtt');
      
      curl.stdout.on('data', (chunk) => {
        if (headersDone) {
          if (isPlaylistOrSub) {
            bodyBuf = Buffer.concat([bodyBuf, chunk]);
          } else {
            res.write(chunk);
          }
          return;
        }
        headerBuf = Buffer.concat([headerBuf, chunk]);
        const headerEnd = headerBuf.indexOf('\r\n\r\n');
        if (headerEnd !== -1) {
          headersDone = true;
          const headerStr = headerBuf.subarray(0, headerEnd).toString('utf8');
          const bodyStart = headerBuf.subarray(headerEnd + 4);
          
          // Parse status line and headers
          const lines = headerStr.split('\r\n');
          const statusMatch = lines[0].match(/HTTP\/\S+\s+(\d+)/);
          const statusCode = statusMatch ? parseInt(statusMatch[1]) : 200;
          
          res.status(statusCode);
          res.set('Access-Control-Allow-Origin', '*');
          
          for (const line of lines.slice(1)) {
            const idx = line.indexOf(': ');
            if (idx === -1) continue;
            const key = line.substring(0, idx).toLowerCase();
            const val = line.substring(idx + 2);
            if (['content-type', 'content-length', 'content-range', 'accept-ranges'].includes(key)) {
              res.set(key, val);
              if (key === 'content-type' && (val.includes('mpegurl') || val.includes('vtt'))) {
                isPlaylistOrSub = true;
              }
            }
          }
          
          if (isPlaylistOrSub) {
             bodyBuf = Buffer.from(bodyStart);
          } else {
             if (bodyStart.length > 0) res.write(bodyStart);
          }
        }
      });
      
      curl.on('close', () => {
         if (isPlaylistOrSub && headersDone) {
            let text = bodyBuf.toString('utf8');
            const baseUrl = new URL(url);
            text = text.replace(/^(?!https?:\/\/|#)[^\r\n]+/gm, match => {
               try { return new URL(match, baseUrl).href; } catch(e) { return match; }
            });
            const rewritten = text.replace(/https?:\/\/[^\s\'\"]+/g, m => {
              let proxyUrl = '/proxy?url=' + encodeURIComponent(m);
              if (parsedHeadersParam) proxyUrl += '&headers=' + encodeURIComponent(parsedHeadersParam);
              return proxyUrl;
            });
            res.send(rewritten);
         } else {
            res.end();
         }
      });
      curl.on('error', (e) => {
        console.error('curl proxy error', e);
        if (!res.headersSent) res.status(502).send('Bad Gateway');
      });
      
      req.on('close', () => {
        if (!res.writableEnded) {
           curl.kill();
        }
      });
    } else {
      // Non-Cloudflare domains: use Node.js https directly
      const fetchHeaders = { 'User-Agent': fullUa, 'Referer': referer, ...headersObj };
      if (req.headers.range) fetchHeaders['Range'] = req.headers.range;
      
      const https = await import('https');
      
      https.get(url, { headers: fetchHeaders }, (fetchRes) => {
        const ct = fetchRes.headers['content-type'] || '';
        
        res.status(fetchRes.statusCode);
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Content-Type', ct);
        
        if (fetchRes.headers['content-length']) res.set('Content-Length', fetchRes.headers['content-length']);
        if (fetchRes.headers['content-range']) res.set('Content-Range', fetchRes.headers['content-range']);
        if (fetchRes.headers['accept-ranges']) res.set('Accept-Ranges', fetchRes.headers['accept-ranges']);
        
        const isPlaylistOrSub = url.includes('.m3u8') || url.includes('.vtt') || ct.includes('mpegurl') || ct.includes('vtt');
        
        if(isPlaylistOrSub){
          let chunks = [];
          fetchRes.on('data', chunk => chunks.push(chunk));
          fetchRes.on('end', () => {
            let text = Buffer.concat(chunks).toString('utf8');
            const baseUrl = new URL(url);
            text = text.replace(/^(?!https?:\/\/|#)[^\r\n]+/gm, match => {
               try { return new URL(match, baseUrl).href; } catch(e) { return match; }
            });
            const rewritten = text.replace(/https?:\/\/[^\s\'\"]+/g, m => {
              let proxyUrl = '/proxy?url=' + encodeURIComponent(m);
              if (parsedHeadersParam) proxyUrl += '&headers=' + encodeURIComponent(parsedHeadersParam);
              return proxyUrl;
            });
            res.send(rewritten);
          });
        } else {
          fetchRes.pipe(res);
        }
      }).on('error', (e) => {
        console.error('proxy error', e);
        res.status(502).send('Bad Gateway');
      });
    }
  }catch(e){
    console.error('proxy catch', e);
    res.status(502).send('Bad Gateway');
  }
});

app.listen(PORT, ()=>console.log(`Fedge server listening at http://localhost:${PORT}`));