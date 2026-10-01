#!/usr/bin/env python3
"""
Phase 7 e2e asset preparation.

Inputs (already in this folder, public-domain official portraits):
  faceA.jpg, faceB.jpg, faceC.jpg

Outputs:
  faceA.rgb / faceB.rgb / faceC.rgb  - 320x320 raw RGB24 face patches the
                                       mock Drive server composites into
                                       generated event photos.
  /tmp/e2e-media/*.y4m               - fake camera streams for headless
                                       Chromium (--use-file-for-fake-video-capture).

Y4M frames are YUV420. Face crops are generous head crops; the single-face
streams fill most of the 640x480 frame so the detector sees a usable face.
"""
import os
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, "assets")
MEDIA = "/tmp/e2e-media"
W, H = 640, 480
PATCH = 320

FACES = ["faceA", "faceB", "faceC"]


def head_crop(img):
    """Crop the head region of a head-and-shoulders portrait."""
    w, h = img.size
    return img.crop((int(w * 0.10), int(h * 0.02), int(w * 0.90), int(h * 0.62)))


def cover(img, w, h):
    """Resize + center-crop to exactly w x h without distortion."""
    src_ratio = img.width / img.height
    dst_ratio = w / h
    if src_ratio > dst_ratio:
        new_w = int(img.height * dst_ratio)
        x = (img.width - new_w) // 2
        img = img.crop((x, 0, x + new_w, img.height))
    else:
        new_h = int(img.width / dst_ratio)
        y = (img.height - new_h) // 2
        img = img.crop((0, y, img.width, y + new_h))
    return img.resize((w, h), Image.LANCZOS)


def rgb_to_yuv420(img):
    """Return (Y, U, V) plane bytes for an RGB image."""
    img = img.convert("RGB")
    y_px = bytearray()
    u_px = bytearray()
    v_px = bytearray()
    pixels = img.load()
    w, h = img.size
    # Luma per pixel
    lumas = [[0] * w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            r, g, b = pixels[x, y]
            yy = min(255, max(0, int(0.299 * r + 0.587 * g + 0.114 * b)))
            lumas[y][x] = yy
            y_px.append(yy)
    # Chroma at 2x2 blocks (positional, matches C420jpeg well enough for a fake cam)
    for cy in range(0, h, 2):
        for cx in range(0, w, 2):
            r = g = b = n = 0
            for dy in (0, 1):
                for dx in (0, 1):
                    pr, pg, pb = pixels[min(cx + dx, w - 1), min(cy + dy, h - 1)]
                    r += pr
                    g += pg
                    b += pb
                    n += 1
            r //= n
            g //= n
            b //= n
            u_px.append(min(255, max(0, int(-0.169 * r - 0.331 * g + 0.500 * b) + 128)))
            v_px.append(min(255, max(0, int(0.500 * r - 0.419 * g - 0.081 * b) + 128)))
    return bytes(y_px), bytes(u_px), bytes(v_px)


def write_y4m(path, frames, frame_count=30):
    with open(path, "wb") as out:
        out.write(f"YUV4MPEG2 W{W} H{H} F10:1 Ip A1:1 C420jpeg\n".encode())
        for _ in range(frame_count):
            out.write(b"FRAME\n")
            y, u, v = frames
            out.write(y)
            out.write(u)
            out.write(v)


def abstract_frame():
    """A soft light-blue/white abstract pattern with no faces."""
    img = Image.new("RGB", (W, H), (241, 247, 251))
    draw = ImageDraw.Draw(img)
    for i in range(6):
        x = 40 + i * 95
        draw.ellipse((x, 60 + (i % 3) * 40, x + 130, 240 + (i % 3) * 40), fill=(212, 228, 239))
    draw.rectangle((0, 360, W, H), fill=(226, 236, 243))
    return img


def main():
    os.makedirs(MEDIA, exist_ok=True)
    heads = {}
    for name in FACES:
        src = Image.open(os.path.join(ASSETS, f"{name}.jpg")).convert("RGB")
        head = head_crop(src)
        heads[name] = head
        # Raw patch for the mock photo compositor
        patch = cover(head, PATCH, PATCH)
        with open(os.path.join(ASSETS, f"{name}.rgb"), "wb") as fh:
            fh.write(patch.tobytes())
        print(f"{name}.rgb {patch.size[0]}x{patch.size[1]} {os.path.getsize(os.path.join(ASSETS, f'{name}.rgb'))} bytes")

    # Single-face camera streams: a large centered face patch on a soft
    # neutral background. Every face gets the same scale and position, and
    # the whole head stays inside the frame (a full-frame cover zoom can
    # cut a head off, which makes the detector miss it).
    CAM_PATCH = 400
    for name in FACES:
        frame = Image.new("RGB", (W, H), (225, 232, 238))
        patch = cover(heads[name], CAM_PATCH, CAM_PATCH)
        frame.paste(patch, ((W - CAM_PATCH) // 2, (H - CAM_PATCH) // 2))
        write_y4m(os.path.join(MEDIA, f"{name}.y4m"), rgb_to_yuv420(frame))
        print(f"{name}.y4m {os.path.getsize(os.path.join(MEDIA, f'{name}.y4m'))} bytes")

    # Two faces side by side (A left, B right)
    two = Image.new("RGB", (W, H), (250, 252, 254))
    two.paste(cover(heads["faceA"], W // 2, H), (0, 0))
    two.paste(cover(heads["faceB"], W // 2, H), (W // 2, 0))
    write_y4m(os.path.join(MEDIA, "twoFaces.y4m"), rgb_to_yuv420(two))
    print(f"twoFaces.y4m {os.path.getsize(os.path.join(MEDIA, 'twoFaces.y4m'))} bytes")

    # No face at all
    write_y4m(os.path.join(MEDIA, "noFace.y4m"), rgb_to_yuv420(abstract_frame()))
    print(f"noFace.y4m {os.path.getsize(os.path.join(MEDIA, 'noFace.y4m'))} bytes")


if __name__ == "__main__":
    sys.exit(main())
