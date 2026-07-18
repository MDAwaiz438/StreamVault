import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

import { playwrightQueue } from './queue.js';

export default {
  extract: async ({ tmdbId, type, s, e, req, res, cache, cacheKey, encryptURL, fallback, server }) => {
    const targetUrl = type === 'tv' ? `https://vidlink.pro/tv/${tmdbId}/${s}/${e}?autoplay=1` : `https://vidlink.pro/movie/${tmdbId}?autoplay=1`;
    const outFile = path.join(os.tmpdir(), `captures_dynamic_${tmdbId}_vidlink_${Date.now()}.json`);

    playwrightQueue.add(() => {
      return new Promise((resolve) => {
        exec(`node dist/playwright_extractor.js "${targetUrl}" "${outFile}"`, { timeout: 90000 }, (err, stdout, stderr) => {
          clearTimeout(fallback);
          
          if (!res.headersSent) {
            if (fs.existsSync(outFile)) {
              try {
                const data = JSON.parse(fs.readFileSync(outFile, 'utf8'));
                try { fs.unlinkSync(outFile); } catch(e) {}
                if (Array.isArray(data)) {
                  // Check responses first for .mp4
                  const mp4Res = data.find(d => d.type === 'response' && (d.url.includes('.mp4') || (d.headers && d.headers['content-type'] === 'video/mp4')));
                  if (mp4Res) {
                    cache.set(cacheKey, { url: mp4Res.url, timestamp: Date.now() });
                    res.json({ encryptedStream: encryptURL(mp4Res.url), server });
                    return resolve();
                  }
      
                  // Check requests for .mp4 from specific domains
                  const mp4Req = data.find(c => c.type === 'request' && c.url.includes('.mp4') && (c.url.includes('vodvidl') || c.url.includes('stormvv') || c.url.includes('hakunaymatata')));
                  if (mp4Req) {
                    cache.set(cacheKey, { url: mp4Req.url, timestamp: Date.now() });
                    res.json({ encryptedStream: encryptURL(mp4Req.url), server });
                    return resolve();
                  }
      
                  // Fallback: look for any .m3u8 request
                  const m3u8Req = data.find(c => c.type === 'request' && c.url.includes('.m3u8'));
                  if (m3u8Req) {
                    cache.set(cacheKey, { url: m3u8Req.url, timestamp: Date.now() });
                    res.json({ encryptedStream: encryptURL(m3u8Req.url), server });
                    return resolve();
                  }
                }
              } catch(e) { console.error('vidlink parse error', e); }
            }
            res.status(404).json({error: 'Stream URL not found on vidlink.pro'});
          }
          resolve();
        });
      });
    });
  }
};
