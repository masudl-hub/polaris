import asyncio
from shazamio import Shazam

async def main():
    shazam = Shazam()
    # let's write 20 seconds of an mp3 with ffmpeg natively
    import subprocess
    subprocess.run(["ffmpeg", "-y", "-f", "lavfi", "-i", "anoisesrc=c=pink:r=44100", "-t", "5", "test_noise.mp3"])
    with open("test_noise.mp3", "rb") as f:
        audio_bytes = f.read()
    print("running shazam")
    out = await shazam.recognize(audio_bytes)
    print("out:", out)

asyncio.run(main())
