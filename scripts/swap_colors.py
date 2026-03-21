#!/usr/bin/env python3
"""
swap_colors.py

Replaces specific colors in an image with new colors based on a mapping.

Usage:
    python swap_colors.py <input_image> <output_image> --map OLD_HEX NEW_HEX [OLD_HEX NEW_HEX ...]

Options:
    --map       One or more OLD NEW hex pairs to swap (with or without leading #)
    --fuzzy N   Match colors within a tolerance of N (0-255, default: 0 = exact match)

Examples:
    # Exact swap: red -> blue, white -> black
    python swap_colors.py sprite.png output.png --map ff0000 0000ff ffffff 000000

    # Fuzzy swap with tolerance of 10
    python swap_colors.py photo.png output.png --map ff0000 00ff00 --fuzzy 10
"""

import argparse
import sys
from PIL import Image
import numpy as np


def parse_hex(hex_str: str) -> tuple[int, ...]:
    """Parse a hex color string (with or without #) into an RGBA tuple."""
    hex_str = hex_str.lstrip("#")
    if len(hex_str) == 6:
        r, g, b = int(hex_str[0:2], 16), int(hex_str[2:4], 16), int(hex_str[4:6], 16)
        return (r, g, b, 255)
    elif len(hex_str) == 8:
        r, g, b, a = (int(hex_str[i:i+2], 16) for i in range(0, 8, 2))
        return (r, g, b, a)
    else:
        raise ValueError(f"Invalid hex color: '#{hex_str}' — expected 6 or 8 hex digits.")


def swap_colors(
    input_path: str,
    output_path: str,
    color_map: dict[tuple, tuple],
    fuzzy: int = 0,
) -> int:
    """
    Replace colors in an image according to color_map.

    Args:
        input_path:   Path to the source image.
        output_path:  Path to write the modified image.
        color_map:    Dict mapping old RGBA tuples -> new RGBA tuples.
        fuzzy:        Per-channel tolerance for matching (0 = exact).

    Returns:
        Total number of pixels changed.
    """
    img = Image.open(input_path).convert("RGBA")
    data = np.array(img, dtype=np.int16)  # int16 to allow signed subtraction

    changed = np.zeros(data.shape[:2], dtype=bool)
    result = data.copy()

    for old_color, new_color in color_map.items():
        old = np.array(old_color, dtype=np.int16)
        new = np.array(new_color, dtype=np.uint8)

        if fuzzy == 0:
            mask = np.all(data == old, axis=2)
        else:
            diff = np.abs(data - old)
            mask = np.all(diff <= fuzzy, axis=2)

        # Don't double-count pixels already changed by an earlier mapping
        mask = mask & ~changed
        result[mask] = new
        changed |= mask

    out_img = Image.fromarray(result.astype(np.uint8), "RGBA")

    # Preserve original mode if it wasn't RGBA
    original_mode = Image.open(input_path).mode
    if original_mode in ("RGB", "P", "L"):
        out_img = out_img.convert(original_mode)

    out_img.save(output_path)
    return int(changed.sum())


def main():
    parser = argparse.ArgumentParser(
        description="Swap specific colors in an image."
    )
    parser.add_argument("input",  help="Path to the input image")
    parser.add_argument("output", help="Path to save the modified image")
    parser.add_argument(
        "--map",
        nargs="+",
        metavar="HEX",
        required=True,
        help="Alternating OLD NEW hex pairs, e.g. --map ff0000 0000ff ffffff 000000",
    )
    parser.add_argument(
        "--fuzzy",
        type=int,
        default=0,
        metavar="N",
        help="Per-channel match tolerance 0-255 (default: 0 = exact)",
    )
    args = parser.parse_args()

    # Validate and pair up the --map values
    if len(args.map) % 2 != 0:
        print("Error: --map requires an even number of hex values (OLD NEW pairs).", file=sys.stderr)
        sys.exit(1)

    color_map: dict[tuple, tuple] = {}
    pairs = list(zip(args.map[0::2], args.map[1::2]))
    for old_hex, new_hex in pairs:
        try:
            old_rgba = parse_hex(old_hex)
            new_rgba = parse_hex(new_hex)
        except ValueError as e:
            print(f"Error: {e}", file=sys.stderr)
            sys.exit(1)
        color_map[old_rgba] = new_rgba

    if not (0 <= args.fuzzy <= 255):
        print("Error: --fuzzy must be between 0 and 255.", file=sys.stderr)
        sys.exit(1)

    try:
        total_changed = swap_colors(args.input, args.output, color_map, fuzzy=args.fuzzy)
    except FileNotFoundError:
        print(f"Error: File not found: {args.input}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    print(f"Saved '{args.output}' — {total_changed} pixel(s) changed across {len(color_map)} color mapping(s).")


if __name__ == "__main__":
    main()
