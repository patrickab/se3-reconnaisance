"""PLY reader for the SE3 reconnaissance point cloud.

Supports binary-little-endian PLY with a single ``vertex`` element (the format
SE3 ships). Returns a numpy structured array memory-mapped from disk, so even
the ~4M-point cloud loads instantly without copying it into RAM.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np

# PLY type name -> numpy type code
_PLY_DTYPE: dict[str, str] = {
    "char": "i1", "uchar": "u1", "int8": "i1", "uint8": "u1",
    "short": "i2", "ushort": "u2", "int16": "i2", "uint16": "u2",
    "int": "i4", "uint": "u4", "int32": "i4", "uint32": "u4",
    "float": "f4", "float32": "f4", "double": "f8", "float64": "f8",
}


def read_ply(path: str | Path) -> np.ndarray:
    """Memory-map a binary-little-endian PLY and return its vertex array.

    Access columns by name, e.g. ``v["x"]``, ``v["red"]``. The dtype is built
    from the header, so extra properties (normals, labels) are picked up
    automatically if SE3 add them later.
    """
    path = Path(path)
    with path.open("rb") as fh:
        raw = fh.read(8192)
    if not raw.startswith(b"ply"):
        raise ValueError(f"{path} is not a PLY file")
    if b"binary_little_endian" not in raw:
        raise ValueError("only binary_little_endian PLY is supported")

    header_end = raw.index(b"\n", raw.index(b"end_header")) + 1
    fields: list[tuple[str, str]] = []
    count = 0
    for line in raw[:header_end].decode("latin1").splitlines():
        parts = line.split()
        if parts[:2] == ["element", "vertex"]:
            count = int(parts[2])
        elif parts and parts[0] == "property" and parts[1] != "list":
            fields.append((parts[2], "<" + _PLY_DTYPE[parts[1]]))

    dtype = np.dtype(fields)
    return np.memmap(path, dtype=dtype, mode="r", offset=header_end, shape=(count,))
