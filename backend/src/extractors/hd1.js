import { curlCffiFetch } from './curl_helper.js';

export default {
  extract: async ({ tmdbId, type, s, e, req, res, cache, cacheKey, encryptURL, fallback, server }) => {
    const apiUrl = type === 'tv' 
      ? `https://vidcore.org/api/sources?id=${tmdbId}&type=tv&season=${s}&episode=${e}` 
      : `https://vidcore.org/api/sources?id=${tmdbId}&type=movie`;
      
    const fullUa = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    
    try {
      const response = curlCffiFetch(apiUrl, {
        'User-Agent': fullUa,
        'Accept': 'application/json',
        'Referer': `https://vidcore.org/embed/${type}/${tmdbId}`
      });
      
      if (response.status !== 200) {
        console.error("VidCore API error:", response.status);
        return res.status(500).json({ error: "Failed to extract from VidCore" });
      }
      
      const data = JSON.parse(response.text);
      let streamUrl = null;

      if (data && data.sources && data.sources.length > 0) {
        for (const srcObj of data.sources) {
          if (srcObj.data && srcObj.data.sources && srcObj.data.sources.length > 0) {
            streamUrl = srcObj.data.sources[0].url;
            if (streamUrl) break;
          }
        }
      }
      
      if (streamUrl) {
        clearTimeout(fallback);
        cache.set(cacheKey, { url: streamUrl, timestamp: Date.now() });
        return res.json({
          encryptedStream: encryptURL(streamUrl),
          streamUrl: streamUrl,
          server: 'VidCore',
          isMp4: streamUrl.includes('.mp4')
        });
      } else {
        return res.status(404).json({ error: "Stream URL not found on VidCore" });
      }
    } catch(e) {
      console.error(`[EXTRACTION ERROR] VidCore parse error:`, e.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'VidCore extraction failed' });
      }
    }
  }
};