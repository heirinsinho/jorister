"""Export Spotify playlist tracks to CSV."""

from __future__ import annotations

import argparse
import csv
import os
import re
import shlex
import sys
import time
from pathlib import Path
from typing import Any

import requests
import spotipy
from spotipy.exceptions import SpotifyException
from spotipy.oauth2 import SpotifyOAuth
from tqdm import tqdm


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT_CSV = Path("spotify_playlist_export.csv")
TOKEN_CACHE_PATH = PROJECT_ROOT / ".spotipy-playlist-cache"
PLAYLIST_SCOPE = "playlist-read-private playlist-read-collaborative"
DEFAULT_MUSICBRAINZ_USER_AGENT = "jorister-playlist-exporter/1.0"
ROW_FIELDS = [
    "track_name",
    "artists",
    "album",
    "spotify_release_date",
    "spotify_year",
    "estimated_original_year",
    "estimated_original_year_source",
    "spotify_url",
    "duration",
    "duration_ms",
    "explicit",
    "popularity",
    "spotify_uri",
    "isrc",
    "added_at",
]


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Export a Spotify playlist to CSV."
    )
    parser.add_argument(
        "playlist",
        help="Spotify playlist URL, URI, or raw playlist id.",
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT_CSV,
        help="CSV file to write. Defaults to spotify_playlist_export.csv.",
    )
    parser.add_argument(
        "--no-browser",
        action="store_true",
        help="Do not open a browser during Spotify OAuth.",
    )
    parser.add_argument(
        "--oauth",
        action="store_true",
        help="Use user OAuth for private or collaborative playlists. This is the default.",
    )
    parser.add_argument(
        "--public",
        action="store_true",
        help="Deprecated. Playlist item export now requires OAuth.",
    )
    parser.add_argument(
        "--clear-cache",
        dest="clear_cache",
        action="store_true",
        default=True,
        help="Remove the saved Spotify OAuth token before signing in. This is the default.",
    )
    parser.add_argument(
        "--use-cache",
        dest="clear_cache",
        action="store_false",
        help="Reuse the saved Spotify OAuth token if one exists.",
    )
    parser.add_argument(
        "--local-callback",
        dest="local_callback",
        action="store_true",
        default=True,
        help=(
            "Use http://127.0.0.1:8080/callback so the CLI can capture "
            "the Spotify OAuth code automatically. This is the default."
        ),
    )
    parser.add_argument(
        "--env-callback",
        dest="local_callback",
        action="store_false",
        help="Use SPOTIFY_REDIRECT_URI from .env instead of the local callback.",
    )
    parser.add_argument(
        "--redirect-uri",
        help=(
            "OAuth redirect URI. Defaults to SPOTIFY_REDIRECT_URI, "
            "SPOTIPY_REDIRECT_URI, NEXTAUTH_URL + /api/auth/callback/spotify, "
            "or http://127.0.0.1:8080/callback."
        ),
    )
    parser.add_argument(
        "--skip-musicbrainz",
        action="store_true",
        help="Skip MusicBrainz ISRC lookups and use Spotify album release years only.",
    )
    parser.add_argument(
        "--musicbrainz-user-agent",
        help=(
            "User-Agent for MusicBrainz requests. Defaults to MUSICBRAINZ_USER_AGENT "
            "or jorister-playlist-exporter/1.0."
        ),
    )
    return parser.parse_args(argv)


def load_project_env(root: Path = PROJECT_ROOT) -> None:
    """Load .env and .env.local using the same Spotify variable names as the app."""
    initial_env_keys = set(os.environ)

    for env_path in (root / ".env", root / ".env.local"):
        if not env_path.exists():
            continue

        for raw_line in env_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue

            key, value = line.split("=", 1)
            key = key.strip()
            if not key or key in initial_env_keys:
                continue

            os.environ[key] = parse_dotenv_value(value)


def parse_dotenv_value(value: str) -> str:
    value = value.strip()
    if not value:
        return ""
    try:
        parts = shlex.split(value, comments=False)
    except ValueError:
        return value.strip("'\"")
    return " ".join(parts) if parts else ""


def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise ValueError(f"Missing {name}. Set it in your environment, .env, or .env.local.")
    return value


def extract_playlist_id(url_or_id: str) -> str:
    """
    Accepts:
    - https://open.spotify.com/playlist/{id}
    - spotify:playlist:{id}
    - raw playlist id
    """
    match = re.search(r"playlist[/:]([A-Za-z0-9]+)", url_or_id)
    return match.group(1) if match else url_or_id.split("?")[0]


def ms_to_mmss(ms: int | None) -> str | None:
    if ms is None:
        return None
    seconds = ms // 1000
    return f"{seconds // 60}:{seconds % 60:02d}"


def musicbrainz_user_agent(args: argparse.Namespace) -> str:
    return (
        args.musicbrainz_user_agent
        or os.environ.get("MUSICBRAINZ_USER_AGENT")
        or DEFAULT_MUSICBRAINZ_USER_AGENT
    )


def get_musicbrainz_original_year_by_isrc(
    isrc: str | None,
    user_agent: str,
) -> tuple[str | None, str | None]:
    """
    Returns:
        (original_year, source)

    Uses MusicBrainz recording search by ISRC.
    """
    if not isrc:
        return None, None

    url = "https://musicbrainz.org/ws/2/recording/"
    params = {
        "query": f"isrc:{isrc}",
        "fmt": "json",
        "limit": 5,
    }
    headers = {
        "User-Agent": user_agent,
    }

    response = requests.get(url, params=params, headers=headers, timeout=20)
    response.raise_for_status()

    data = response.json()
    recordings = data.get("recordings", [])

    candidate_dates = []

    for recording in recordings:
        first_date = recording.get("first-release-date")
        if first_date:
            candidate_dates.append(first_date)

        for release in recording.get("releases", []):
            date = release.get("date")
            if date:
                candidate_dates.append(date)

    if not candidate_dates:
        return None, None

    earliest = min(candidate_dates)
    return earliest[:4], "MusicBrainz ISRC"


def spotify_client(args: argparse.Namespace) -> spotipy.Spotify:
    load_project_env()

    client_id = require_env("SPOTIFY_CLIENT_ID")
    client_secret = require_env("SPOTIFY_CLIENT_SECRET")

    if args.public:
        raise ValueError(
            "Spotify playlist item export now requires user OAuth. "
            "Run without --public."
        )

    if args.clear_cache and TOKEN_CACHE_PATH.exists():
        TOKEN_CACHE_PATH.unlink()

    redirect_uri = oauth_redirect_uri(args)

    auth_manager = SpotifyOAuth(
        client_id=client_id,
        client_secret=client_secret,
        redirect_uri=redirect_uri,
        scope=PLAYLIST_SCOPE,
        open_browser=not args.no_browser,
        cache_path=str(TOKEN_CACHE_PATH),
        show_dialog=True,
    )
    return spotipy.Spotify(auth_manager=auth_manager)


def oauth_redirect_uri(args: argparse.Namespace) -> str:
    if args.local_callback:
        return "http://127.0.0.1:8080/callback"

    return (
        args.redirect_uri
        or os.environ.get("SPOTIPY_REDIRECT_URI")
        or default_nextauth_redirect_uri()
        or "http://127.0.0.1:8080/callback"
    )


def default_nextauth_redirect_uri() -> str | None:
    nextauth_url = os.environ.get("NEXTAUTH_URL")
    if not nextauth_url:
        return None
    return f"{nextauth_url.rstrip('/')}/api/auth/callback/spotify"


def track_to_row(
    item: dict[str, Any],
    original_year: str | None,
    original_year_source: str | None,
) -> dict[str, Any] | None:
    track = item.get("track") or item.get("item")
    if not track:
        return None

    if track.get("type") != "track":
        return None

    url = track.get("external_urls", {}).get("spotify")
    if not url:
        return None

    spotify_release_date = track.get("album", {}).get("release_date")
    spotify_year = spotify_release_date[:4] if spotify_release_date else None
    isrc = track.get("external_ids", {}).get("isrc")

    return {
        "track_name": track.get("name"),
        "artists": ", ".join(artist["name"] for artist in track.get("artists", [])),
        "album": track.get("album", {}).get("name"),
        "spotify_release_date": spotify_release_date,
        "spotify_year": spotify_year,
        "estimated_original_year": original_year or spotify_year,
        "estimated_original_year_source": (
            original_year_source or "Spotify album release date"
        ),
        "spotify_url": url,
        "duration": ms_to_mmss(track.get("duration_ms")),
        "duration_ms": track.get("duration_ms"),
        "explicit": track.get("explicit"),
        "popularity": track.get("popularity"),
        "spotify_uri": track.get("uri"),
        "isrc": isrc,
        "added_at": item.get("added_at"),
    }


def fetch_playlist_rows(
    sp: spotipy.Spotify,
    playlist_id: str,
    args: argparse.Namespace,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    musicbrainz_cache: dict[str, tuple[str | None, str | None]] = {}
    user_agent = musicbrainz_user_agent(args)
    token = sp.auth_manager.get_access_token(as_dict=False)
    url = f"https://api.spotify.com/v1/playlists/{playlist_id}/items"
    params = {
        "additional_types": "track",
        "fields": (
            "items(added_at,item("
            "type,id,name,artists(name),album(name,release_date),"
            "external_urls.spotify,duration_ms,explicit,popularity,uri,external_ids.isrc"
            ")),next,total"
        ),
        "limit": 100,
    }
    progress: tqdm[Any] | None = None

    try:
        while url:
            response = requests.get(
                url,
                headers={"Authorization": f"Bearer {token}"},
                params=params,
                timeout=30,
            )
            if response.status_code >= 400:
                message = response.text
                try:
                    message = response.json().get("error", {}).get("message", message)
                except ValueError:
                    pass
                raise SpotifyException(response.status_code, -1, message)

            results = response.json()
            if progress is None:
                label = (
                    "Exporting tracks"
                    if args.skip_musicbrainz
                    else "Exporting tracks with MusicBrainz"
                )
                progress = tqdm(
                    total=results.get("total"),
                    desc=label,
                    unit="track",
                )

            for item in results["items"]:
                track = item.get("track") or item.get("item")
                isrc = track.get("external_ids", {}).get("isrc") if track else None
                original_year, original_year_source = None, None

                if isrc and not args.skip_musicbrainz:
                    if isrc not in musicbrainz_cache:
                        try:
                            musicbrainz_cache[isrc] = (
                                get_musicbrainz_original_year_by_isrc(
                                    isrc,
                                    user_agent,
                                )
                            )
                        except requests.RequestException as error:
                            tqdm.write(
                                f"MusicBrainz lookup failed for ISRC {isrc}: {error}",
                                file=sys.stderr,
                            )
                            musicbrainz_cache[isrc] = (None, None)
                        time.sleep(1)

                    original_year, original_year_source = musicbrainz_cache[isrc]

                row = track_to_row(item, original_year, original_year_source)
                if row:
                    rows.append(row)
                if progress:
                    progress.update(1)

            url = results.get("next")
            params = None
    finally:
        if progress:
            progress.close()

    return rows


def write_csv(rows: list[dict[str, Any]], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=ROW_FIELDS)
        writer.writeheader()
        writer.writerows(rows)


def print_spotify_error(error: SpotifyException, args: argparse.Namespace) -> None:
    if getattr(error, "http_status", None) == 403:
        if not args.public:
            print(
                "Spotify returned 403 while using OAuth. The signed-in Spotify "
                "account cannot read this playlist, or the app is not allowed for "
                "that account.",
                file=sys.stderr,
            )
            print(
                "Check that the playlist is shared with that Spotify account. "
                "If your Spotify app is in development mode, also add that account "
                "under the app's Users and Access settings.",
                file=sys.stderr,
            )
        else:
            print(
                "Spotify returned 403 while using public playlist access.",
                file=sys.stderr,
            )
            print(
                "If this playlist is private or collaborative, rerun without --public "
                "so the CLI uses SPOTIFY_REDIRECT_URI from .env.",
                file=sys.stderr,
            )
        return

    print(error, file=sys.stderr)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)

    try:
        sp = spotify_client(args)
        rows = fetch_playlist_rows(sp, extract_playlist_id(args.playlist), args)
    except ValueError as error:
        print(error, file=sys.stderr)
        return 2
    except SpotifyException as error:
        print_spotify_error(error, args)
        return 2

    output_path = args.output.resolve()
    write_csv(rows, output_path)
    print(f"Exported {len(rows)} tracks")
    print(f"CSV: {output_path}")

    return 0
