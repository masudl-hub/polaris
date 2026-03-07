import yt_dlp
import json

url = "https://www.youtube.com/shorts/MKN1iYybItY"

ydl_opts = {
    'quiet': True,
    'extract_flat': True,
    'skip_download': True,
}

with yt_dlp.YoutubeDL(ydl_opts) as ydl:
    info = ydl.extract_info(url, download=False)

print("Title:", info.get('title'))
print("Track:", info.get('track'))
print("Artist:", info.get('artist'))
print("Album:", info.get('album'))
print("Creator:", info.get('creator'))
print("Uploader:", info.get('uploader'))
print("\nFull music details if present:")
if 'artist' in info or 'track' in info:
    print(f"Detected Track: {info.get('track')} by {info.get('artist')}")
else:
    print("No explicit track metadata found in YouTube info block.")
