#!/usr/bin/env python3
"""
extract_colors.py

Reads an image and prints all unique hex color values present in it.

Usage:
    python extract_colors.py <image_path> [--sort] [--no-alpha]

Options:
    --sort      Sort colors by frequency (most common first)
    --no-alpha  Ignore alpha channel (treat all pixels as opaque RGB)

Example:
    python extract_colors.py sprite.png
    python extract_colors.py sprite.png --sort
"""

import argparse
import sys
from PIL import Image
from collections import Counter


def extract_colors(image_path: str, sort_by_frequency: bool = False, ignore_alpha: bool = False) -> list[str]:
    """
    Extract all unique hex color values from an image.

    Args:
        image_path:          Path to the input image.
        sort_by_frequency:   If True, return colors sorted by frequency (most common first).
        ignore_alpha:        If True, strip alpha and return 6-digit hex values only.

    Returns:
        List of hex color strings (e.g. ["#ff0000", "#00ff00aa"]).
    """
    img = Image.open(image_path)

    # Normalize to RGBA so every pixel has 4 channels
    img = img.convert("RGBA")
    pixels = list(img.getdata())

    if ignore_alpha:
        pixels = [(r, g, b) for r, g, b, _ in pixels]
        fmt = "#{:02x}{:02x}{:02x}"
    else:
        fmt = "#{:02x}{:02x}{:02x}{:02x}"

    if sort_by_frequency:
        counts = Counter(pixels)
        unique_pixels = [px for px, _ in counts.most_common()]
    else:
        seen = set()
        unique_pixels = []
        for px in pixels:
            if px not in seen:
                seen.add(px)
                unique_pixels.append(px)

    return [fmt.format(*px) for px in unique_pixels]


def main():
    parser = argparse.ArgumentParser(
        description="Extract all unique hex colors from an image."
    )
    parser.add_argument("image", help="Path to the input image")
    parser.add_argument(
        "--sort", action="store_true", help="Sort by frequency (most common first)"
    )
    parser.add_argument(
        "--no-alpha", action="store_true", help="Ignore alpha channel (RGB only)"
    )
    args = parser.parse_args()

    try:
        colors = extract_colors(args.image, sort_by_frequency=args.sort, ignore_alpha=args.no_alpha)
    except FileNotFoundError:
        print(f"Error: File not found: {args.image}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    print(f"Found {len(colors)} unique color(s) in '{args.image}':\n")
    for color in colors:
        print(color)


if __name__ == "__main__":
    main()
