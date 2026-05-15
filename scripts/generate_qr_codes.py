#!/usr/bin/env python3
"""Compatibility wrapper for the Jorister QR CLI."""

from __future__ import annotations

from jorister_cli.qr import main


if __name__ == "__main__":
    raise SystemExit(main())
