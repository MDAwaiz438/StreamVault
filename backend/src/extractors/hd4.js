import { curlCffiFetch } from './curl_helper.js';

export default {
  extract: async ({ tmdbId, type, s, e, req, res, cache, cacheKey, encryptURL, fallback, server }) => {
    const apiUrl = type === 'tv' 
      ? `https://new.vidnest.fun/moviebox/tv/${tmdbId}/${s}/${e}` 
      : `https://new.vidnest.fun/moviebox/movie/${tmdbId}`;

    try {
      const response = curlCffiFetch(apiUrl, {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      });

      if (response.status !== 200) {
         return res.status(500).json({ error: `Failed to extract from ${server}` });
      }

      const data = JSON.parse(response.text);
      if (!data || !data.data || !data.encrypted) {
         return res.status(404).json({error: `Stream URL not found on ${server}`});
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
         return res.status(404).json({error: `Stream URL not found on ${server}`});
      }
    } catch(e) {
      console.error(`[EXTRACTION ERROR] ${server} parse error:`, e.message);
      if (!res.headersSent) {
          res.status(500).json({error: 'Extraction failed'});
      }
    }
  }
};
