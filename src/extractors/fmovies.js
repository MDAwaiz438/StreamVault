import { exec } from 'child_process';

export default {
  extract: async ({ tmdbId, type, s, e, req, res, cache, cacheKey, encryptURL, fallback, server }) => {
    const apiUrl = type === 'tv' 
      ? `https://new.vidnest.fun/moviebox/tv/${tmdbId}/${s}/${e}` 
      : `https://new.vidnest.fun/moviebox/movie/${tmdbId}`;
      
    const fullUa = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    
    exec(`curl -s -L -H "User-Agent: ${fullUa}" "${apiUrl}"`, (err, stdout, stderr) => {
      clearTimeout(fallback);
      if (res.headersSent) return;
      
      if (err || !stdout) {
        console.error("Vidnest API error:", err || stderr);
        return res.status(500).json({ error: "Failed to extract from fmovies" });
      }
      
      try {
        const data = JSON.parse(stdout);
        if (!data || !data.data || !data.encrypted) {
          return res.status(404).json({error: `Stream URL not found on fmovies`});
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
           cache.set(cacheKey, { url: bestStream, timestamp: Date.now() });
           return res.json({ encryptedStream: encryptURL(bestStream), server });
        } else {
           return res.status(404).json({error: `Stream URL not found on fmovies`});
        }
      } catch(e) {
        console.error(`[EXTRACTION ERROR] ${server} parse error:`, e, "Output:", stdout.substring(0, 100));
        res.status(500).json({error: 'Extraction failed'});
      }
    });
  }
};