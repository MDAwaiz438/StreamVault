interface VideoDetails {
    title: string;
    server: string;
    ref: string;
    xid: string;
    uwuId: string;
    episodeId: string;
    hash: string;
    poster: string;
    servers?: Server[];
    seasons?: Season[];
}
interface Season {
    id: string;
    seasonNumber: string;
    episodes: Episode[];
}
interface Episode {
    id: string;
    episodeNumber: string;
    title: string;
}
interface Server {
    name: string;
    hash: string;
}
declare function getVideo(id: number, season?: number, episode?: number): Promise<VideoDetails | undefined>;
interface StreamDetails {
    source: string;
    subtitles: Subtitle[];
    skips: any[];
    format: string;
}
interface Subtitle {
    label: string;
    file: string;
}
declare function getStreamUrl(hash: string): Promise<StreamDetails>;
declare function addCount(player: string, referer: string, title: string): void;
export { getVideo, getStreamUrl, addCount };
export type { VideoDetails, StreamDetails, Subtitle };
