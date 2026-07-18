import { captureMediaFromUrl } from './playwright_extractor.js';
const VIDLINK_PRO_BASE_URL = 'https://vidlink.pro';
/**
 * Fetches the raw video source URL from vidlink.pro.
 * It uses a Playwright extractor to find an intermediate API URL, then fetches it to get the final source.
 * @param params The parameters for the movie, TV show, or anime.
 * @returns The raw .m3u8 video source URL.
 */
export const getVideo = async (params) => {
    let embedUrl;
    if (params.type === 'movie') {
        embedUrl = `${VIDLINK_PRO_BASE_URL}/movie/${params.id}`;
    }
    else if (params.type === 'tv') {
        embedUrl = `${VIDLINK_PRO_BASE_URL}/tv/${params.id}/${params.season}/${params.episode}`;
    }
    else {
        embedUrl = `${VIDLINK_PRO_BASE_URL}/anime/${params.id}/${params.episode}`;
    }
    // 1. Use the extractor to find the intermediate API call
    const captures = await captureMediaFromUrl(embedUrl);
    const apiRequest = captures.find(c => c.type === 'request' && c.url.includes('/api/b/'));
    if (!apiRequest) {
        throw new Error('Could not find the vidlink.pro API request. The site may have changed.');
    }
    // 2. Find the response body from the captures
    const apiResponse = captures.find(c => c.type === 'response' && c.url === apiRequest.url);
    if (!apiResponse || !apiResponse.body) {
        throw new Error('Could not find the vidlink.pro API response body in captures.');
    }
    let streamData;
    try {
        streamData = JSON.parse(apiResponse.body);
    }
    catch (e) {
        throw new Error('Failed to parse vidlink.pro API response: ' + String(e));
    }
    if (streamData.stream && streamData.stream.qualities) {
        const qualities = streamData.stream.qualities;
        // Prefer 1080, then 720, then 480, then 360
        const url = (qualities['1080'] && qualities['1080'].url) ||
            (qualities['720'] && qualities['720'].url) ||
            (qualities['480'] && qualities['480'].url) ||
            (qualities['360'] && qualities['360'].url);
        if (url)
            return url;
    }
    throw new Error('Stream URL not found in vidlink.pro API response: ' + JSON.stringify(streamData).substring(0, 200));
};
