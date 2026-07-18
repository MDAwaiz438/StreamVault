interface Capture {
    type: 'request' | 'response';
    url: string;
    method?: string;
    status?: number;
    headers: Record<string, string>;
    body?: string | null;
}
declare function captureMediaFromUrl(targetUrl: string, outFile?: string | null): Promise<Capture[]>;
export { captureMediaFromUrl };
