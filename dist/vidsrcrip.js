const API_URL = "https://vidsrc.rip/";
/*
 * Get the video configuration
 * @param id TMDB/IMDB movie or TV show id
 * @param season The season number (for TV shows)
 * @param episode The episode number (for TV shows)
 * @returns The video configuration
 */
async function getVideo(id, season, episode) {
    let url;
    if (season !== undefined && episode !== undefined) {
        url = `${API_URL}/embed/tv/${id}/${season}/${episode}`;
    }
    else {
        url = `${API_URL}/embed/movie/${id}`;
    }
    const response = await fetch(url);
    const html = await response.text();
    const match = html.match(/window\.config\s*=\s*(\{.*?\});/s);
    if (match && match[1]) {
        const config = parseConfig(match[1]);
        return config;
    }
    else {
        console.error("Didn't find config in the page");
    }
}
/*
 * Parse the video configuration from the page
 * @param configString The string containing the video configuration
 * @returns The parsed video configuration
 */
function parseConfig(configString) {
    const content = configString.slice(1, -1).trim();
    const config = {};
    const regex = /(\w+):\s*(?:'([^']*)'|"([^"]*)"|(\[[^\]]*\])|([^,}]+))/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
        const [, key, singleQuoted, doubleQuoted, arrayValue, unquotedValue] = match;
        let value = singleQuoted || doubleQuoted || unquotedValue;
        if (arrayValue) {
            value = JSON.parse(arrayValue);
        }
        if (key === "servers" && typeof value === "string") {
            value = [value];
        }
        config[key] = value;
    }
    return config;
}
/*
 * Get the stream URL
 * @param server The server name
 * @param id The movie or TV show id
 * @param season The season number (for TV shows)
 * @param episode The episode number (for TV shows)
 * @returns The stream URL
 */
async function getStreamUrl(server, id, season, episode) {
    const eheeh = `/api/source/${server}/${id}`;
    const key = await getKey();
    const url = new URL(`${API_URL}${eheeh}`);
    const vrf = generateVRF(key, eheeh);
    url.searchParams.append("vrf", vrf);
    if (season !== undefined && episode !== undefined) {
        url.searchParams.append("s", season);
        url.searchParams.append("e", episode);
    }
    const response = await fetch(url.toString());
    if (!response.ok) {
        console.error("Error fetching stream details:", response.statusText);
        return;
    }
    const data = await response.json();
    if (response.status === 500) {
        console.error("Error in vidsrc.rip side:", data.error);
        console.warn("Test another server");
        return;
    }
    return data;
}
/*
 * Get the key for the XOR encryption
 * @returns The key
 */
async function getKey() {
    let url = API_URL + "/images/skip-button.png"; // since the token change every time, bro make my life a bit simpler please :(
    const response = await fetch(url);
    const res = await response.text();
    return res;
}
/*
 * XOR encrypt or decrypt a message
 * @param key The key for the XOR encryption
 * @param message The message to encrypt or decrypt
 * @returns The encrypted or decrypted message
 */
function xorEncryptDecrypt(key, message) {
    let keyCodes = Array.from(key, (char) => char.charCodeAt(0));
    let messageCodes = Array.from(message, (char) => char.charCodeAt(0));
    let result = [];
    for (let i = 0; i < messageCodes.length; i++) {
        result.push(messageCodes[i] ^ keyCodes[i % keyCodes.length]);
    }
    return String.fromCharCode.apply(null, result);
}
/*
 * Generate the VRF
 * @param key The key for the XOR encryption
 * @param encodedMessage The encoded message
 * @returns The generated VRF
 */
function generateVRF(key, encodedMessage) {
    let decodedMessage = decodeURIComponent(encodedMessage);
    let xorResult = xorEncryptDecrypt(key, decodedMessage);
    return encodeURIComponent(Buffer.from(xorResult).toString("base64"));
}
export { getVideo, getStreamUrl };
