import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

export default {
  extract: async ({ tmdbId, type, s, e, req, res, cache, cacheKey, encryptURL, fallback, server }) => {
    // Determine the target URL based on type
    const targetUrl = type === 'tv' 
        ? `https://vidsrc.sbs/embed/tv/${tmdbId}/${s}/${e}` 
        : `https://vidsrc.sbs/embed/movie/${tmdbId}`;

    const outFile = path.join(os.tmpdir(), `captures_dynamic_${tmdbId}_vidsrc2_${Date.now()}.json`);

    exec(`node dist/playwright_extractor.js "${targetUrl}" "${outFile}"`, (err, stdout, stderr) => {
      clearTimeout(fallback);
      if (res.headersSent) return;

      try {
        if (!fs.existsSync(outFile)) {
          console.error(`[EXTRACTION ERROR] ${server} No output file generated.`);
          return res.status(404).json({error: `Stream URL not found on vidsrc2`});
        }
        
        const data = JSON.parse(fs.readFileSync(outFile, 'utf8'));
        try { fs.unlinkSync(outFile); } catch(e) {}

        if (Array.isArray(data)) {
          // Look for any request or response containing .mp4 or .m3u8
          let streamRes = data.find(d => d.type === 'response' && (d.url.includes('.mp4') || d.url.includes('.m3u8') || (d.headers && (d.headers['content-type'] === 'video/mp4' || d.headers['content-type'] === 'application/vnd.apple.mpegurl'))));
          
          if (!streamRes) {
            streamRes = data.find(c => c.type === 'request' && (c.url.includes('.mp4') || c.url.includes('.m3u8') || c.method === 'DECODED'));
          }

          const subReq = data.find(d => d.type === 'response' && (d.url.includes('.vtt') || (d.headers && d.headers['content-type'] === 'text/vtt')));
          
          if (streamRes) {
            let streamUrl = streamRes.url;
            if (streamRes.method === 'DECODED') streamUrl = decodeURIComponent(streamUrl);
            
            const result = { encryptedStream: encryptURL(streamUrl), server };
            if (subReq) result.subtitleUrl = subReq.url;
            cache.set(cacheKey, { ...result, url: streamUrl, timestamp: Date.now() });
            return res.json(result);
          }
        }
        res.status(404).json({error: `Stream URL not found on vidsrc2`});
      } catch (e) {
        console.error(`[EXTRACTION ERROR] ${server} parse error:`, e);
        res.status(500).json({error: 'Extraction failed'});
      }
    });
  }
};
