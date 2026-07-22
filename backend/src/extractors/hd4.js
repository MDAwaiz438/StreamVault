import { curlCffiFetch } from './curl_helper.js';
import crypto from 'crypto';

function decodeBase64Url(str) {
    let t = str.replace(/-/g, "+").replace(/_/g, "/");
    let i = t.length % 4 == 0 ? "" : "=".repeat(4 - t.length % 4);
    return Buffer.from(t + i, 'base64');
}

function decryptPeachify(encodedData) {
    const key = Buffer.from("a8f2a1b5e9c470814f6b2c3a5d8e7f9c1a2b3c4d5e3f7a8b8cad1e2d0a4d5c5d", 'hex');
    const [ivStr, cipherStr, tagStr] = encodedData.split(".");
    
    const iv = decodeBase64Url(ivStr);
    const ciphertext = decodeBase64Url(cipherStr);
    const authTag = decodeBase64Url(tagStr);
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(ciphertext, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
}

export default {
    extract: async ({ tmdbId, type, s, e, res, cache, cacheKey, encryptURL, fallback, server }) => {
        try {
            const endpoint = type === 'tv' ? 
                `https://usa.eat-peach.sbs/air/tv/${tmdbId}/${s}/${e}` : 
                `https://usa.eat-peach.sbs/air/movie/${tmdbId}`;

            const response = await curlCffiFetch(endpoint, {
                'Referer': 'https://peachify.pro/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            });

            let json;
            try {
                json = JSON.parse(response.text);
            } catch (e) {
                console.error('[HD4] JSON Parse Error. Response was:', response.text.substring(0, 200));
                return res.status(502).json({ error: 'Upstream blocked request (Cloudflare/IP Block)', details: response.text.substring(0, 100) });
            }

            if (json.isEncrypted && json.data) {
                const decrypted = decryptPeachify(json.data);
                
                if (decrypted && decrypted.sources && decrypted.sources.length > 0) {
                    const bestSource = decrypted.sources.find(s => s.type === 'hls') || decrypted.sources[0];
                    clearTimeout(fallback);
                    cache.set(cacheKey, { url: bestSource.url, timestamp: Date.now() });
                    return res.json({ 
                        encryptedStream: encryptURL(bestSource.url),
                        server,
                        isMp4: bestSource.url.includes('.mp4'),
                        headers: {
                            'Referer': 'https://peachify.pro/',
                            'Origin': 'https://peachify.pro'
                        }
                    });
                }
            }

            return res.status(404).json({ error: 'No sources found on peachify' });
        } catch (error) {
            console.error('[EXTRACTION ERROR] Peachify:', error.message);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Peachify extraction failed', details: error.message });
            }
        }
    }
};
