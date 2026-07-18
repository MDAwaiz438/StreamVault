import Crypto from "crypto-js"; // Using crypto-js instead of node's crypto because it'll be too long to find what type of AES encryption is used
const API_URL = "	https://vidsrc.icu/app";
const key = "oiqweSdnuy@14ssd@124HATEQ";
async function getData(params) {
    let url;
    if (params.type === 'anime') {
        url = new URL(`${API_URL}/api-anime`);
        url.searchParams.append('id', params.id.toString());
        url.searchParams.append('e', params.episode.toString());
        params.dub && url.searchParams.append('dub', params.dub.toString());
    }
    else {
        url = new URL(`${API_URL}/api-manga`);
        url.searchParams.append('id', params.id.toString());
        url.searchParams.append('c', params.chapter.toString());
    }
    const response = await fetch(url.toString());
    const encryptedData = await response.json();
    if (!response.ok || encryptedData.error) {
        console.error("Error fetching stream details:", response.statusText);
        encryptedData.error && console.error(encryptedData.error);
        return;
    }
    if (params.type === 'anime') {
        const subtitles = decrypt(JSON.parse(encryptedData.subtitles), key);
        const thumbnail = decrypt(JSON.parse(encryptedData.thumbnails), key);
        const source = decrypt(JSON.parse(encryptedData.source), key);
        return {
            title: encryptedData.title,
            source,
            thumbnail,
            subtitle: subtitles,
            intro: encryptedData.intro,
            outro: encryptedData.outro
        };
    }
    const images = decrypt(JSON.parse(encryptedData.images), key);
    return { images };
}
function decrypt(content, key) {
    const { ct, iv, s } = content;
    let cipherParams = Crypto.lib.CipherParams.create({ ciphertext: Crypto.enc.Base64.parse(ct) });
    cipherParams.iv = Crypto.enc.Hex.parse(iv);
    cipherParams.salt = Crypto.enc.Hex.parse(s);
    const decrypted = Crypto.AES.decrypt(cipherParams, key).toString(Crypto.enc.Utf8);
    return JSON.parse(decrypted);
}
export { getData };
