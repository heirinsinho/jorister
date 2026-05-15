/// <reference types="spotify-web-playback-sdk" />

export type SpotifySdkPlayer = Spotify.Player;

type SpotifySdkWindow = Window &
	typeof globalThis & {
		Spotify?: typeof Spotify;
		onSpotifyWebPlaybackSDKReady?: () => void;
	};

export const getSpotifySdkWindow = () => window as SpotifySdkWindow;

export const hasSpotifySdk = () =>
	typeof window !== "undefined" && Boolean(getSpotifySdkWindow().Spotify);
