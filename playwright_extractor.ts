import { chromium } from 'playwright-extra';
import type { Browser, Request, Response } from 'playwright';
import stealth from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';

chromium.use(stealth());

process.on('uncaughtException', (err) => {
  console.error('Ignored uncaught exception:', err);
});

function decode1EmbedProxyUrl(url: string) {
  try {
    const b64 = url.split('d=bs_')[1]?.split('&')[0];
    if (b64) {
      let decoded = Buffer.from(b64, 'base64').toString('utf8').split('').reverse().join('');
      const httpIdx = decoded.indexOf('http');
      if (httpIdx !== -1) decoded = decoded.substring(httpIdx);
      return decoded;
    }
  } catch (e) {}
  return url;
}

interface Capture {
  type: 'request' | 'response';
  url: string;
  method?: string;
  status?: number;
  headers: Record<string, string>;
  body?: string | null;
}

async function captureMediaFromUrl(targetUrl: string, outFile: string | null = 'captures.json') {
  let browser: Browser | null = null;
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const captures: Capture[] = [];
  const seen = new Set<string>();
  const timeoutMs = 85000;
  let streamFound = false;

  let timedOut = false;
  const timeout = setTimeout(() => {
    console.error('Timeout waiting for media requests (fallback)');
    timedOut = true;
  }, timeoutMs);

  page.on('request', (request: Request) => {
    const url = request.url();
    if (seen.has(url)) return;
    seen.add(url);
    console.log('>> Request:', request.method(), url);
    
    // Auto-decode 1embed/vidsrc proxy urls
    if (url.includes('api/proxy') && url.includes('d=bs_')) {
      const decoded = decode1EmbedProxyUrl(url);
      console.log('==================================================');
      console.log('[DECODED STREAM]:', decoded);
      console.log('==================================================');
      captures.push({ type: 'request', method: 'DECODED', url: decoded, headers: {} });
      streamFound = true;
    }
    
    captures.push({ type: 'request', method: request.method(), url, headers: request.headers() });
  });

  page.on('response', async (response: Response) => {
    try {
      const url = response.url();
      const headers = response.headers();
      const ctype = (headers['content-type'] || '').toLowerCase();
      if (seen.has(url) && captures.some(c => c.url === url && c.type === 'response')) return;
      if (url.includes('/api/b/') || url.includes('.m3u8') || url.includes('.mp4') || ctype.includes('application/json') || ctype.includes('application/octet-stream') || ctype.includes('vnd.apple.mpegurl') || /convert-h264/.test(url) || url.includes('throbbing') || url.includes('hydrastream') || url.includes('player.nhdapi.com') || url.includes('cdn')) {
        console.log('<< Response:', response.status(), url);
        if (url.includes('.m3u8') || url.includes('.mp4')) {
          streamFound = true; // Signal to exit early
        }
        let body: string | null = null;
        try {
          if (ctype.includes('application/json') || ctype.startsWith('text')) {
            body = await response.text();
          } else {
            const buffer = await response.body();
            body = buffer.toString('base64');
          }
        } catch (err) {
          body = `<<failed to read body: ${String(err)}>>`;
        }
        captures.push({ type: 'response', status: response.status(), url, headers, body });
      }
    } catch (err) {
      // swallow
    }
  });

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 90000 }).catch(() => {});
  try {
    await page.waitForTimeout(2000);
    
    console.log('Simulating interaction (click) to start player...');
    const viewportSize = page.viewportSize();
    
    // Attempt multiple clicks to clear ad overlays and trigger the player
    for (let i = 0; i < 35; i++) {
      if (streamFound) {
        console.log(`Stream found early after ${i} clicks! Exiting wait.`);
        break;
      }
      
      if(viewportSize) {
        await page.mouse.click(viewportSize.width / 2, viewportSize.height / 2, { delay: 10 }).catch(()=>{});
      }
      
      const frames = page.frames();
      for (const frame of frames) {
         await frame.locator('body').click({force: true, delay: 10}).catch(()=>{});
      }
      
      // Wait for network activity, check if stream found
      await page.waitForTimeout(300); 
    }
    
    // Final wait just in case stream is still loading
    if (!streamFound) {
      for(let i=0; i<3; i++) {
         if (streamFound) break;
         await page.waitForTimeout(1000);
      }
    }
  } catch (e) {
    console.error('Error during interaction simulation', e);
  }

  if (outFile) {
    fs.writeFileSync(outFile, JSON.stringify(captures, null, 2), 'utf8');
    console.log('Saved captures to', outFile);
  }
  clearTimeout(timeout);
  try {
    if (!timedOut) await browser.close();
    else await browser.close();
  } catch (e) {
    // ignore
  }
  return captures;
}

export { captureMediaFromUrl };

// CLI: node dist/playwright_extractor.js <url> [out.json]
if (process.argv.length > 2) {
  let target = process.argv[2];
  const out = process.argv[3] || 'captures.json';
  
  (async () => {
    try {
      await captureMediaFromUrl(target, out);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })();
}