"""Generate test fixture files for the Polaris test suite."""
import cv2
import numpy as np
import os

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "fixtures")
os.makedirs(FIXTURES_DIR, exist_ok=True)

# 1. Small test image (100x100 with text overlay)
img = np.zeros((100, 100, 3), dtype=np.uint8)
img[:] = (30, 30, 30)
cv2.putText(img, "TEST AD", (5, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
cv2.putText(img, "BuyNow", (10, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 200, 255), 1)
cv2.imwrite(os.path.join(FIXTURES_DIR, "sample_image.jpg"), img)

# 2. Small test video (1 second, 10fps, 100x100)
fourcc = cv2.VideoWriter_fourcc(*"mp4v")
out = cv2.VideoWriter(os.path.join(FIXTURES_DIR, "sample_video.mp4"), fourcc, 10.0, (100, 100))
for i in range(10):
    frame = np.zeros((100, 100, 3), dtype=np.uint8)
    frame[:] = (20 + i * 5, 20, 40)
    cv2.putText(frame, "F" + str(i), (30, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
    out.write(frame)
out.release()

img_path = os.path.join(FIXTURES_DIR, "sample_image.jpg")
vid_path = os.path.join(FIXTURES_DIR, "sample_video.mp4")
print(f"sample_image.jpg: {os.path.getsize(img_path)} bytes")
print(f"sample_video.mp4: {os.path.getsize(vid_path)} bytes")
