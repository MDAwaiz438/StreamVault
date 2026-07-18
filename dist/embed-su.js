const API_URL = "https://embed.su";
/*
 * Get the video details
 * @param id TMDB movie or TV show id
 * @param season The season number (for TV shows)
 * @param episode The episode number (for TV shows)
 * @returns The video details
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
    if (!response.ok) {
        console.error("Error fetching video details:", response.statusText);
        return;
    }
    const html = await response.text();
    const match = html.match(/window\.vConfig = JSON\.parse\(atob\(`(.+?)`\)\)/);
    if (match && match[1]) {
        const decodedData = JSON.parse(Buffer.from(match[1], "base64").toString());
        let firstDecode = atob(decodedData.hash).split(".").map(item => { return item.split("").reverse().join(""); });
        let secondDecode = JSON.parse(atob(firstDecode.join("").split("").reverse().join("")));
        const servers = secondDecode.map((server) => { return { name: server.name, hash: server.hash }; });
        return {
            ...decodedData,
            servers: servers,
        };
    }
    console.error("Unable to extract video details");
}
/*
 * Get the stream URL
 * @param hash The server hash, not the video hash
 * @returns The stream URL
 */
async function getStreamUrl(hash) {
    const url = `${API_URL}/api/e/${hash}`;
    const response = await fetch(url);
    const data = await response.json();
    if (response.status === 404) {
        console.error("Error fetching stream details:", data.error);
    }
    return {
        source: data.source,
        subtitles: data.subtitles,
        skips: data.skips,
        format: data.format,
    };
}
// because why not even tho it's useless, it's just a count
function addCount(player, referer, title) {
    const url = "https://pixel.embed.su/count";
    const params = new URLSearchParams({
        p: player,
        r: referer,
        t: title,
    });
    fetch(url, {
        method: "POST",
        body: params,
    }).catch((error) => {
        console.error("Error adding count:", error);
    });
}
export { getVideo, getStreamUrl, addCount };
