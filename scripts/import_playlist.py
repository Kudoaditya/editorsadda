#!/usr/bin/env python3
"""
EditorsAdda — YouTube Playlist & Video Importer (Python 3)
Usage:
  python3 scripts/import_playlist.py "https://www.youtube.com/playlist?list=PLxxxxxx"
  python3 scripts/import_playlist.py "videoID1,videoID2,videoID3"
"""

import sys
import os
import re
import json
import urllib.request
import urllib.parse

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
TRACKS_FILE = os.path.join(SCRIPT_DIR, "..", "tracks.json")

def clean_title(raw_title):
    if not raw_title:
        return "Unknown Track", "EditorsAdda"
    
    # Remove common video tags
    title = re.sub(r"\s*\(Official (Music )?(Video|Audio)\)", "", raw_title, flags=re.IGNORECASE)
    title = re.sub(r"\s*\[Official (Music )?(Video|Audio)\]", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\s*\[HD\]|\s*\(HD\)", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\s*\|.*$", "", title).strip()

    artist = "EditorsAdda"
    if " - " in title:
        parts = title.split(" - ", 1)
        artist = parts[0].strip()
        title = parts[1].strip()

    return title, artist

def fetch_oembed(video_id):
    try:
        url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            raw = data.get("title", "")
            title, artist = clean_title(raw)
            return {
                "id": video_id,
                "title": title or raw,
                "artist": data.get("author_name") or artist,
                "album": "EditorsAdda Timeline Cuts",
                "duration": 240,
                "cover": f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
                "rawTitle": raw
            }
    except Exception as e:
        return {
            "id": video_id,
            "title": f"Track {video_id}",
            "artist": "EditorsAdda",
            "album": "EditorsAdda Session",
            "duration": 240,
            "cover": f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
            "rawTitle": f"YouTube Track {video_id}"
        }

def extract_playlist_ids(playlist_url):
    print(f"🔍 Fetching playlist from {playlist_url}...")
    try:
        req = urllib.request.Request(
            playlist_url,
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
            }
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode("utf-8", errors="ignore")
            matches = re.findall(r'"videoId":"([a-zA-Z0-9_-]{11})"', html)
            seen = set()
            unique = []
            for m in matches:
                if m not in seen:
                    seen.add(m)
                    unique.append(m)
            return unique
    except Exception as e:
        print(f"⚠️ Could not fetch playlist directly: {e}")
        return []

def main():
    if len(sys.argv) < 2:
        print("""
🎧 EditorsAdda Playlist Importer
------------------------------------
Usage:
  python3 scripts/import_playlist.py "<YouTube Playlist URL or Video IDs>"

Examples:
  python3 scripts/import_playlist.py "https://www.youtube.com/playlist?list=PL..."
  python3 scripts/import_playlist.py "dQw4w9WgXcQ,3NWMK2MRqIk,9b0iydtDZLU"
""")
        sys.exit(0)

    arg = sys.argv[1].strip()
    video_ids = []

    if "list=" in arg or "playlist" in arg:
        video_ids = extract_playlist_ids(arg)
    elif "," in arg:
        video_ids = [s.strip() for s in arg.split(",") if s.strip()]
    elif "watch?v=" in arg:
        parsed = urllib.parse.urlparse(arg)
        qs = urllib.parse.parse_qs(parsed.query)
        v = qs.get("v")
        if v:
            video_ids = [v[0]]
    else:
        video_ids = [arg]

    if not video_ids:
        print("❌ No video IDs found. Please check your playlist link.")
        sys.exit(1)

    print(f"✨ Found {len(video_ids)} tracks. Fetching metadata...")
    tracks = []
    for i, vid in enumerate(video_ids, 1):
        print(f"  [{i}/{len(video_ids)}] Fetching {vid}...", end=" ", flush=True)
        track = fetch_oembed(vid)
        tracks.append(track)
        print(f"✅ \"{track['title']}\" - {track['artist']}")

    with open(TRACKS_FILE, "w", encoding="utf-8") as f:
        json.dump(tracks, f, indent=2, ensure_ascii=False)

    print(f"\n🎉 Successfully saved {len(tracks)} tracks into tracks.json!")

if __name__ == "__main__":
    main()
