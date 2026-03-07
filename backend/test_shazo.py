import asyncio
from shazamio import Shazam
import os

async def main():
    shazam = Shazam()
    print("Testing shazam setup...")
    print("Setup ok.")
    
asyncio.run(main())
