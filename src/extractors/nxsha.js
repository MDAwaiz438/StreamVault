import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

import { playwrightQueue } from './queue.js';

export default {
  extract: async ({ tmdbId, type, s, e, req, res, cache, cacheKey, encryptURL, fallback, server }) => {
    let targetUrl = type === 'tv' ? `https://nxsha.space/embed/tv/${tmdbId}/${s}/${e}?` : `https://nxsha.space/embed/movie/${tmdbId}?`;
    
    // Default to english if nothing provided
    const lang = req.query.advLang || 'en';
    targetUrl += `lang=${lang}`;
    
    if (req.query.advServer) targetUrl += `&server=${req.query.advServer}`;
    if (req.query.advSub) targetUrl += `&sub=${req.query.advSub}`;
    if (req.query.advOneServer) targetUrl += `&one_server=true`;
    
    const outFile = path.join(os.tmpdir(), `captures_dynamic_${tmdbId}_nxsha_advanced_${Date.now()}.json`);

    playwrightQueue.add(() => {
      return new Promise((resolve) => {
        exec(`node dist/playwright_extractor.js "${targetUrl}" "${outFile}"`, (err, stdout, stderr) => {
          clearTimeout(fallback);
          if (!res.headersSent) {
            try {
              if (!fs.existsSync(outFile)) {
                console.error(`[EXTRACTION ERROR] ${server} No output file generated.`);
                res.status(404).json({error: `Stream URL not found on nxsha`});
                return resolve();
              }
              const data = JSON.parse(fs.readFileSync(outFile, 'utf8'));
              try { fs.unlinkSync(outFile); } catch(e) {}
              if (Array.isArray(data)) {
                let streamRes = data.find(d => d.type === 'response' && (d.url.includes('.mp4') || d.url.includes('.m3u8') || (d.headers && (d.headers['content-type'] === 'video/mp4' || d.headers['content-type'] === 'application/vnd.apple.mpegurl'))));
                if (!streamRes) {
                  streamRes = data.find(c => c.type === 'request' && (c.url.includes('.mp4') || c.url.includes('.m3u8')));
                }
                const subReq = data.find(d => d.type === 'response' && (d.url.includes('.vtt') || (d.url.includes('api/subtitles') && !d.url.includes('/api/sources')) || (d.headers && d.headers['content-type'] === 'text/vtt')));
                
                if (streamRes) {
                  const result = { encryptedStream: encryptURL(streamRes.url), server };
                  if (subReq) result.subtitleUrl = subReq.url;
                  cache.set(cacheKey, { ...result, url: streamRes.url, timestamp: Date.now() });
                  res.json(result);
                  return resolve();
                }
              }
              res.status(404).json({error: `Stream URL not found on nxsha`});
            } catch (e) {
              console.error(`[EXTRACTION ERROR] ${server} parse error:`, e);
              res.status(500).json({error: 'Extraction failed'});
            }
          }
          resolve();
        });
      });
    });
  }
};
