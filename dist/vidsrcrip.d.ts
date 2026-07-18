interface VideoConfig {
    key: string;
    tmdbId: string;
    server: string;
    servers: string[];
    season?: string;
    episode?: string;
}
interface Stream {
    sources: {
        file: string;
        label: string;
    }[];
}
declare function getVideo(id: string, season?: number, episode?: number): Promise<VideoConfig | undefined>;
declare function getStreamUrl(server: string, id: string, season?: string, episode?: string): Promise<Stream | undefined>;
export { getVideo, getStreamUrl };
export type { VideoConfig, Stream };
