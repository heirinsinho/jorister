"use client";

import { motion } from "framer-motion";
import { Loader2, Pause, Play, ScanLine } from "lucide-react";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	getSpotifySdkWindow,
	type SpotifySdkPlayer,
} from "@/lib/spotifySdkWindow";
import { useSpotifyWebPlaybackSDK } from "./SpotifyScriptProvider";

interface SpotifyPlayerProps {
	trackId: string;
	onScanNext: () => void;
}

const VISUALIZER_BARS = Array.from({ length: 15 }, (_, index) => ({
	delay: (index % 5) * 0.04,
	duration: 0.55 + (index % 4) * 0.08,
	heights: [
		"20%",
		`${58 + ((index * 11) % 34)}%`,
		`${28 + ((index * 7) % 22)}%`,
		`${72 + ((index * 5) % 28)}%`,
		"36%",
	],
	id: `visualizer-bar-${index}`,
}));

const PLAYER_ACTIVATION_DELAY_MS = 500;
const DEVICE_SYNC_DELAY_MS = 1500;
const DEFAULT_PLAYBACK_ERROR =
	"No se pudo reproducir la canción. Comprueba que tu cuenta tiene Spotify Premium.";

interface SpotifyApiErrorPayload {
	error?: {
		message?: string;
	};
}

const sleep = (milliseconds: number) =>
	new Promise((resolve) => window.setTimeout(resolve, milliseconds));

const getSpotifyApiErrorMessage = async (response: Response) => {
	try {
		const payload = (await response.json()) as SpotifyApiErrorPayload;
		if (payload.error?.message) {
			return `Spotify API: ${payload.error.message}`;
		}
	} catch {
		// Some Spotify errors have an empty body; fall back to the status text.
	}

	const statusText = response.statusText
		? ` (${response.status} ${response.statusText})`
		: ` (${response.status})`;

	return `${DEFAULT_PLAYBACK_ERROR}${statusText}`;
};

const getPlaybackErrorMessage = (error: unknown) =>
	error instanceof Error ? error.message : DEFAULT_PLAYBACK_ERROR;

export default function SpotifyPlayer({
	trackId,
	onScanNext,
}: SpotifyPlayerProps) {
	const { data: session } = useSession();
	const { isReady } = useSpotifyWebPlaybackSDK();
	const accessToken = session?.accessToken;

	const [player, setPlayer] = useState<SpotifySdkPlayer | null>(null);
	const [deviceId, setDeviceId] = useState<string | null>(null);
	const [isPaused, setIsPaused] = useState(true);
	const [isActive, setIsActive] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [hasStarted, setHasStarted] = useState(false);
	const [isStarting, setIsStarting] = useState(false);
	const lastRequestedTrackIdRef = useRef<string | null>(null);

	const playSong = useCallback(
		async (
			spotifyPlayer: SpotifySdkPlayer,
			playbackDeviceId: string,
			token: string,
			spotifyTrackId: string,
		) => {
			if (!spotifyTrackId) return false;

			setError(null);

			try {
				await spotifyPlayer.activateElement();
				await sleep(PLAYER_ACTIVATION_DELAY_MS);

				const playRequest = async () => {
					return fetch(
						`https://api.spotify.com/v1/me/player/play?${new URLSearchParams({
							device_id: playbackDeviceId,
						})}`,
						{
							method: "PUT",
							headers: {
								Authorization: `Bearer ${token}`,
								"Content-Type": "application/json",
							},
							body: JSON.stringify({
								uris: [`spotify:track:${spotifyTrackId}`],
							}),
						},
					);
				};

				let response = await playRequest();

				if (response.status === 404) {
					await fetch("https://api.spotify.com/v1/me/player", {
						method: "PUT",
						headers: {
							Authorization: `Bearer ${token}`,
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							device_ids: [playbackDeviceId],
							play: false,
						}),
					});

					await sleep(DEVICE_SYNC_DELAY_MS);
					response = await playRequest();
				}

				if (!response.ok) {
					throw new Error(await getSpotifyApiErrorMessage(response));
				}

				setIsActive(true);
				setIsPaused(false);
				return true;
			} catch (error) {
				setError(getPlaybackErrorMessage(error));
				setIsActive(false);
				setIsPaused(true);
				return false;
			}
		},
		[],
	);

	useEffect(() => {
		const spotifyWindow = getSpotifySdkWindow();

		if (!isReady || !accessToken || !spotifyWindow.Spotify) return;

		setError(null);

		const spotifyPlayer = new spotifyWindow.Spotify.Player({
			name: "jorister Player",
			getOAuthToken: (cb) => {
				cb(accessToken);
			},
			volume: 0.8,
		});

		spotifyPlayer.addListener("ready", ({ device_id: nextDeviceId }) => {
			setDeviceId(nextDeviceId);
		});

		spotifyPlayer.addListener("not_ready", () => {
			setDeviceId(null);
			setIsActive(false);
		});

		spotifyPlayer.addListener("player_state_changed", (state) => {
			setIsPaused(state.paused);
			setIsActive(true);
		});

		spotifyPlayer.addListener("initialization_error", ({ message }) => {
			setError(`Error de inicialización: ${message}`);
		});

		spotifyPlayer.addListener("authentication_error", ({ message }) => {
			setError(`Error de autenticación: ${message}`);
		});

		spotifyPlayer.addListener("account_error", ({ message }) => {
			setError(`Error de cuenta (requiere Premium): ${message}`);
		});

		spotifyPlayer.addListener("playback_error", ({ message }) => {
			setError(`Error de reproducción: ${message}`);
		});

		spotifyPlayer.addListener("autoplay_failed", () => {
			setError("El navegador bloqueó el inicio automático del audio.");
		});

		void spotifyPlayer
			.connect()
			.then((success) => {
				if (!success) {
					setError("No se pudo conectar el reproductor web de Spotify.");
				}
			})
			.catch(() => {
				setError("No se pudo conectar el reproductor web de Spotify.");
			});

		setPlayer(spotifyPlayer);

		return () => {
			spotifyPlayer.disconnect();
		};
	}, [isReady, accessToken]);

	useEffect(() => {
		if (!player || !deviceId || !accessToken || !hasStarted || !trackId) {
			return;
		}

		if (lastRequestedTrackIdRef.current === trackId) return;

		let isCancelled = false;
		lastRequestedTrackIdRef.current = trackId;
		setIsStarting(true);

		void playSong(player, deviceId, accessToken, trackId).finally(() => {
			if (!isCancelled) {
				setIsStarting(false);
			}
		});

		return () => {
			isCancelled = true;
		};
	}, [player, deviceId, accessToken, hasStarted, trackId, playSong]);

	const canStartPlayback = Boolean(
		player && deviceId && accessToken && trackId,
	);
	const isVisualizerActive = hasStarted && !isPaused && isActive && !isStarting;

	const handleStartPlayback = useCallback(async () => {
		if (!player || !deviceId || !accessToken || !trackId || isStarting) return;

		setHasStarted(true);
		setIsStarting(true);
		lastRequestedTrackIdRef.current = trackId;

		await playSong(player, deviceId, accessToken, trackId);
		setIsStarting(false);
	}, [accessToken, deviceId, isStarting, playSong, player, trackId]);

	const togglePlay = useCallback(async () => {
		if (!player || isStarting) return;

		try {
			setError(null);
			await player.togglePlay();
		} catch (error) {
			setError(getPlaybackErrorMessage(error));
		}
	}, [isStarting, player]);

	const handleScanNext = useCallback(async () => {
		lastRequestedTrackIdRef.current = null;

		if (player) {
			try {
				await player.pause();
				setIsPaused(true);
			} catch {
				// Scanning the next code should still work if pause is unavailable.
			}
		}

		onScanNext();
	}, [onScanNext, player]);

	return (
		<div className="flex w-full max-w-md flex-col items-center justify-center space-y-10 p-4 sm:p-6">
			<div className="text-center space-y-2">
				<h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-500">
					Modo Ciego
				</h2>
				<p className="text-slate-400 text-sm">
					Escucha y adivina. Sin pistas visuales.
				</p>
			</div>

			{error ? (
				<div
					role="alert"
					className="w-full rounded-2xl border border-red-500/50 bg-red-500/10 p-4 text-center"
				>
					<p className="text-red-400 text-sm font-medium">{error}</p>
					<div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
						<button
							type="button"
							onClick={handleStartPlayback}
							disabled={!canStartPlayback || isStarting}
							className="rounded-full bg-red-400 px-4 py-2 text-sm font-bold text-slate-950 transition-colors hover:bg-red-300 disabled:cursor-not-allowed disabled:opacity-60"
						>
							Reintentar
						</button>
						<button
							type="button"
							onClick={handleScanNext}
							className="rounded-full border border-red-400/40 px-4 py-2 text-sm font-medium text-red-100 transition-colors hover:bg-red-500/10"
						>
							Escanear otra
						</button>
					</div>
				</div>
			) : !deviceId ? (
				<div
					role="status"
					aria-live="polite"
					className="flex flex-col items-center justify-center py-12 space-y-4"
				>
					<Loader2 className="w-12 h-12 text-green-500 animate-spin" />
					<p className="text-slate-400 text-sm animate-pulse">
						Conectando con Spotify...
					</p>
				</div>
			) : !hasStarted ? (
				<div className="flex flex-col items-center justify-center space-y-6">
					<div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
						<Play className="w-8 h-8 text-green-400 ml-1" />
					</div>
					<p className="text-slate-300 text-center text-sm px-4">
						El reproductor web necesita permiso para lanzar el audio en este
						navegador.
					</p>
					<button
						type="button"
						onClick={handleStartPlayback}
						disabled={!canStartPlayback || isStarting}
						className="inline-flex items-center justify-center gap-2 rounded-full bg-green-500 px-8 py-4 font-bold text-slate-900 shadow-[0_0_20px_rgba(34,197,94,0.3)] transition-all hover:scale-105 hover:bg-green-400 hover:shadow-[0_0_30px_rgba(34,197,94,0.5)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
					>
						{isStarting ? (
							<Loader2 className="h-5 w-5 animate-spin" />
						) : (
							<Play className="h-5 w-5" />
						)}
						<span>Comenzar reproducción</span>
					</button>
				</div>
			) : (
				<>
					<div
						aria-hidden="true"
						className="flex h-48 w-full max-w-[280px] items-end justify-center gap-2"
					>
						{VISUALIZER_BARS.map((bar) => (
							<motion.div
								key={bar.id}
								className="w-3 rounded-full bg-gradient-to-t from-green-500 to-emerald-300"
								animate={{
									height: isVisualizerActive ? bar.heights : "20%",
									opacity: isVisualizerActive ? [0.6, 1, 0.8] : 0.4,
								}}
								transition={{
									delay: bar.delay,
									duration: isVisualizerActive ? bar.duration : 0.2,
									ease: "easeInOut",
									repeat: isVisualizerActive ? Infinity : 0,
									repeatType: "reverse",
								}}
								style={{
									minHeight: "12px",
								}}
							/>
						))}
					</div>

					<div className="flex flex-col items-center w-full space-y-8 mt-12">
						<button
							type="button"
							aria-label={isPaused ? "Reproducir" : "Pausar"}
							title={isPaused ? "Reproducir" : "Pausar"}
							onClick={togglePlay}
							disabled={isStarting}
							className="group relative flex h-20 w-20 items-center justify-center rounded-full bg-green-500 shadow-[0_0_30px_rgba(34,197,94,0.4)] transition-all duration-300 hover:scale-105 hover:bg-green-400 hover:shadow-[0_0_40px_rgba(34,197,94,0.6)] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100"
						>
							<div className="absolute inset-0 rounded-full bg-white/20 scale-0 group-hover:scale-100 transition-transform duration-300 ease-out origin-center" />
							{isStarting ? (
								<Loader2 className="relative z-10 h-10 w-10 animate-spin text-slate-900" />
							) : isPaused ? (
								<Play className="w-10 h-10 text-slate-900 ml-2 relative z-10" />
							) : (
								<Pause className="w-10 h-10 text-slate-900 relative z-10" />
							)}
						</button>

						<button
							type="button"
							onClick={handleScanNext}
							disabled={isStarting}
							className="flex items-center space-x-2 rounded-full border border-slate-700 bg-slate-800 px-6 py-3 text-slate-200 transition-colors duration-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
						>
							<ScanLine className="w-5 h-5" />
							<span className="font-medium">Escanear Siguiente</span>
						</button>
					</div>
				</>
			)}
		</div>
	);
}
