from curl_cffi import requests

targets = ["chrome110", "chrome120", "chrome119", "safari15_3", "safari15_5", "edge99"]

for t in targets:
    try:
        s = requests.Session(impersonate=t)
        res = s.get("https://vixsrc.to/movie/533535", headers={"User-Agent": "Mozilla/5.0"}, timeout=10)
        print(f"target: {t} -> status: {res.status_code}, length: {len(res.text)}")
    except Exception as e:
        print(f"target: {t} -> err: {e}")
