export function decode1EmbedProxyUrl(url) {
    try {
        const urlObj = new URL(url);
        const dParam = urlObj.searchParams.get('d');
        if (!dParam || !dParam.startsWith('bs_')) {
            return url;
        }
        // 1. Strip 'bs_' prefix
        const stripped = dParam.slice(3);
        // 2. URL Decode
        const urlDecoded = decodeURIComponent(stripped);
        // 3. Base64 Decode
        const base64Decoded = Buffer.from(urlDecoded, 'base64').toString('utf8');
        // 4. Reverse String
        const reversed = base64Decoded.split('').reverse().join('');
        return reversed;
    }
    catch (e) {
        console.error('Failed to decode 1embed proxy URL', e);
        return url;
    }
}
