#!/usr/bin/env python3
"""/tmp/ico-<size>.png を束ねて public/favicon.ico を作る。

各サイズの PNG は先に rsvg-convert で書き出しておくこと（assets/README.md 参照）。
ICO の中身は PNG のまま格納する（Vista 以降 / モダンブラウザはすべて対応）。
"""

import pathlib
import struct

SIZES = [16, 32, 48, 64, 128, 256]
SOURCE_DIR = pathlib.Path("/tmp")
OUTPUT = pathlib.Path(__file__).resolve().parent.parent / "public" / "favicon.ico"


def main() -> None:
    pngs = [(size, (SOURCE_DIR / f"ico-{size}.png").read_bytes()) for size in SIZES]

    header = struct.pack("<HHH", 0, 1, len(pngs))
    offset = len(header) + 16 * len(pngs)
    entries, blobs = b"", b""

    for size, data in pngs:
        dimension = 0 if size == 256 else size  # ICO では 256 を 0 で表す
        entries += struct.pack("<BBBBHHII", dimension, dimension, 0, 0, 1, 32, len(data), offset)
        blobs += data
        offset += len(data)

    OUTPUT.write_bytes(header + entries + blobs)
    print(f"{OUTPUT} ({OUTPUT.stat().st_size} bytes, sizes: {SIZES})")


if __name__ == "__main__":
    main()
