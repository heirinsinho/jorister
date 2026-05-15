"""Generate persistent PNG QR codes for URLs."""

from __future__ import annotations

import argparse
import hashlib
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

import qrcode


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "public" / "qr"


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate persistent PNG QR codes from one or more URLs."
    )
    parser.add_argument("urls", nargs="*", help="URLs to encode.")
    parser.add_argument(
        "-i",
        "--input",
        type=Path,
        help="Optional text file containing one URL per line. Blank lines and # comments are ignored.",
    )
    parser.add_argument(
        "-o",
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help="Directory for generated PNG files. Defaults to public/qr.",
    )
    parser.add_argument(
        "--name",
        help="Output filename stem for a single URL. The .png extension is added automatically.",
    )
    parser.add_argument("--box-size", type=int, default=12, help="Pixels per QR module.")
    parser.add_argument("--border", type=int, default=4, help="Quiet-zone width in modules.")
    parser.add_argument("--fill-color", default="black", help="QR foreground color.")
    parser.add_argument("--back-color", default="white", help="QR background color.")
    return parser.parse_args(argv)


def read_urls(args: argparse.Namespace) -> list[str]:
    urls = list(args.urls)

    if args.input:
        lines = args.input.read_text(encoding="utf-8").splitlines()
        urls.extend(
            line.strip()
            for line in lines
            if line.strip() and not line.lstrip().startswith("#")
        )

    if not urls:
        raise ValueError("Provide at least one URL or pass --input with a URL list.")

    if args.name and len(urls) != 1:
        raise ValueError("--name can only be used when generating a single QR code.")

    return urls


def validate_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError(f"Invalid URL: {url!r}. Use an absolute http:// or https:// URL.")
    return url


def stable_filename(url: str, custom_name: str | None) -> str:
    if custom_name:
        stem = custom_name
    else:
        parsed = urlparse(url)
        readable = f"{parsed.netloc}{parsed.path}".strip("/") or "qr-code"
        stem = re.sub(r"[^a-zA-Z0-9._-]+", "-", readable).strip("-._")
        digest = hashlib.sha256(url.encode("utf-8")).hexdigest()[:10]
        stem = f"{stem[:70]}-{digest}"

    if not stem.lower().endswith(".png"):
        stem = f"{stem}.png"
    return stem


def generate_png(
    url: str,
    output_path: Path,
    box_size: int,
    border: int,
    fill_color: str,
    back_color: str,
) -> None:
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=box_size,
        border=border,
    )
    qr.add_data(url)
    qr.make(fit=True)

    image = qr.make_image(fill_color=fill_color, back_color=back_color).convert("RGB")
    image.save(output_path, format="PNG")


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)

    try:
        urls = [validate_url(url) for url in read_urls(args)]
    except ValueError as error:
        print(error, file=sys.stderr)
        return 2

    output_dir = args.output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    for url in urls:
        output_path = output_dir / stable_filename(url, args.name)
        generate_png(
            url=url,
            output_path=output_path,
            box_size=args.box_size,
            border=args.border,
            fill_color=args.fill_color,
            back_color=args.back_color,
        )
        print(f"{url} -> {output_path}")

    return 0
