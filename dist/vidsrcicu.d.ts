interface Manga {
    images: string[];
}
interface Anime {
    title: string;
    source: string;
    thumbnail: string;
    subtitle: string;
    intro: Timestamp;
    outro: Timestamp;
}
interface Timestamp {
    start: number;
    end: number;
}
interface AnimeParams {
    type: 'anime';
    id: number;
    episode: number;
    dub?: 0 | 1;
}
interface MangaParams {
    type: 'manga';
    id: number;
    chapter: number;
}
type DataParams = AnimeParams | MangaParams;
declare function getData(params: DataParams): Promise<Anime | Manga | undefined>;
export { getData };
export type { Anime, Manga, Timestamp, AnimeParams, MangaParams };
