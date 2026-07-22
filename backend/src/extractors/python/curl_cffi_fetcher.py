import sys
import json
from curl_cffi import requests

def fetch_url():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No URL provided"}))
        return

    url = sys.argv[1]
    
    headers = {}
    if len(sys.argv) > 2:
        try:
            headers = json.loads(sys.argv[2])
        except:
            pass

    try:
        session = requests.Session(impersonate="chrome120")
        response = session.get(url, headers=headers, timeout=15)
        
        result = {
            "status": response.status_code,
            "text": response.text,
            "headers": dict(response.headers)
        }
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    fetch_url()
