from curl_cffi import requests

urls = [
    "https://vidsrc.me/embed/movie?tmdb=533535",
    "https://vidsrc.in/embed/movie?tmdb=533535",
    "https://vidsrc.pm/embed/movie?tmdb=533535",
    "https://vidsrc.xyz/embed/movie?tmdb=533535",
    "https://vidsrc.cc/v2/embed/movie/533535",
    "https://embed.su/embed/movie/533535",
    "https://vidlink.pro/movie/533535",
    "https://autoembed.cc/embed/movie/533535",
    "https://www.vidcore.org/api/sources?id=533535&type=movie",
    "https://new.vidnest.fun/moviebox/movie/533535",
    "https://usa.eat-peach.sbs/air/movie/533535"
]

s = requests.Session(impersonate="chrome120")
for u in urls:
    try:
        res = s.get(u, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}, timeout=8)
        print(f"URL: {u[:45]}... -> status: {res.status_code}, len: {len(res.text)}")
    except Exception as e:
        print(f"URL: {u[:45]}... -> ERR: {e}")
