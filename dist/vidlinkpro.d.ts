export interface MovieParams {
    id: string;
    type: 'movie';
}
export interface TVParams {
    id: string;
    type: 'tv';
    season: number;
    episode: number;
}
export interface AnimeParams {
    id: string;
    type: 'anime';
    episode: number;
}
export type VideoParams = MovieParams | TVParams | AnimeParams;
/**
 * Fetches the raw video source URL from vidlink.pro.
 * It uses a Playwright extractor to find an intermediate API URL, then fetches it to get the final source.
 * @param params The parameters for the movie, TV show, or anime.
 * @returns The raw .m3u8 video source URL.
 */
export declare const getVideo: (params: VideoParams) => Promise<string>;
