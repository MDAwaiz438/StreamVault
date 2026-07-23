import { curlCffiFetch } from './curl_helper.js';

export default {
  extract: async ({ tmdbId, type, s, e, req, res, cache, cacheKey, encryptURL, fallback, server }) => {
    // vidfast.vc shares the identical backend CDN (moon.ironwallnet.net) with vidnest.
    // Since vidfast's frontend relies on Cloudflare Turnstile and human-click events, 
    // we bypass the frontend entirely and fetch the raw encrypted payload using curl_cffi 
    // to mimic Chrome and avoid TLS blocking.
    
    const apiUrl = type === 'tv' 
      ? `https://new.vidnest.fun/moviebox/tv/${tmdbId}/${s}/${e}` 
      : `https://new.vidnest.fun/moviebox/movie/${tmdbId}`;

    try {
      // Using curl_cffi to bypass Cloudflare/TLS fingerprinting
      const response = curlCffiFetch(apiUrl, {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      });

      if (response.status !== 200) {
         console.error("vidfast API error:", response.status);
         return res.status(500).json({ error: "Failed to extract from vidfast" });
      }

      const data = JSON.parse(response.text);
      if (!data || !data.data || !data.encrypted) {
         return res.status(404).json({error: `Stream URL not found on vidfast`});
      }
      
      const custom = 'RB0fpH8ZEyVLkv7c2i6MAJ5u3IKFDxlS1NTsnGaqmXYdUrtzjwObCgQP94hoeW+/=';
      const std = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
      let translated = '';
      for(let i=0; i<data.data.length; i++) { 
         translated += std[custom.indexOf(data.data[i])]; 
      }
      const decoded = Buffer.from(translated, 'base64').toString('utf8');
      const parsed = JSON.parse(decoded);
      
      if (parsed && parsed.url && parsed.url.length > 0) {
         let bestStream = parsed.url[0].link;
         for (const u of parsed.url) {
            if (u.resolution === '1080p') { bestStream = u.link; break; }
         }
         
         clearTimeout(fallback);
         cache.set(cacheKey, { url: bestStream, timestamp: Date.now() });
         return res.json({ encryptedStream: encryptURL(bestStream), streamUrl: bestStream, server, isMp4: bestStream.includes('.mp4') });
      } else {
         return res.status(404).json({error: `Stream URL not found on vidfast`});
      }
    } catch(err) {
      console.error(`[EXTRACTION ERROR] ${server} parse error:`, err.message);
      res.status(500).json({error: 'Extraction failed'});
    }
  }
};
