"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useSpotifyWebPlaybackSDK } from "./SpotifyScriptProvider";
import { motion } from "framer-motion";
import { Play, Pause, ScanLine, Loader2 } from "lucide-react";

interface SpotifyPlayerProps {
  trackId: string;
  onScanNext: () => void;
}

export default function SpotifyPlayer({ trackId, onScanNext }: SpotifyPlayerProps) {
  const { data: session } = useSession();
  const { isReady } = useSpotifyWebPlaybackSDK();
  
  const [player, setPlayer] = useState<Spotify.Player | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);

  const playSong = useCallback(async (player_instance: Spotify.Player, device_id: string, token: string, track_id: string) => {
    try {
      console.log("Activating player element...");
      await player_instance.activateElement();
      await new Promise((resolve) => setTimeout(resolve, 500));

      const playRequest = async () => {
        return fetch(`https://api.spotify.com/v1/me/player/play?device_id=${device_id}`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ uris: [`spotify:track:${track_id}`] }),
        });
      };

      console.log("Sending initial play command...");
      let response = await playRequest();

      // If device not found, try to force transfer and retry
      if (response.status === 404) {
        console.warn("Device not found on first try. Forcing transfer...");
        
        await fetch("https://api.spotify.com/v1/me/player", {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ device_ids: [device_id], play: false }),
        });

        console.log("Waiting for backend sync...");
        await new Promise((resolve) => setTimeout(resolve, 1500));

        console.log("Retrying play command...");
        response = await playRequest();
      }

      if (!response.ok) {
        let errorMessage = "Failed to play track. Ensure you have Spotify Premium.";
        try {
            const errData = await response.json();
            errorMessage = `Spotify API Error: ${errData.error?.message || response.statusText}`;
            console.error("Spotify Play Error Data:", errData);
        } catch(e) { /* ignore */ }
        throw new Error(errorMessage);
      }
    } catch (err: any) {
      setError(err.message || "Error al reproducir la canción.");
      console.error("Caught error in playSong:", err);
    }
  }, []);

  useEffect(() => {
    if (!isReady || !session?.accessToken || player) return;

    const token = session.accessToken;
    
    const spotifyPlayer = new window.Spotify.Player({
      name: "Lusi-Hits Player",
      getOAuthToken: (cb) => {
        cb(token);
      },
      volume: 0.8,
    });

    spotifyPlayer.addListener("ready", ({ device_id }) => {
      console.log("Ready with Device ID", device_id);
      setDeviceId(device_id);
      // Wait for user interaction instead of autoplaying directly
    });

    spotifyPlayer.addListener("not_ready", ({ device_id }) => {
      console.log("Device ID has gone offline", device_id);
      setDeviceId(null);
    });

    spotifyPlayer.addListener("player_state_changed", (state) => {
      if (!state) return;
      setIsPaused(state.paused);
      
      spotifyPlayer.getCurrentState().then((s) => {
        setIsActive(!!s);
      });
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

    spotifyPlayer.connect().then((success) => {
      if (success) {
        console.log("The Web Playback SDK successfully connected to Spotify!");
      }
    });

    setPlayer(spotifyPlayer);

    return () => {
      spotifyPlayer.disconnect();
    };
  }, [isReady, session, player, playSong]); // REMOVED trackId from dep to avoid confusion

  // Effect to handle track changes once the player is already initialized and unlocked
  useEffect(() => {
    if (player && deviceId && session?.accessToken && hasStarted && trackId) {
       console.log("New track detected, auto-playing...", trackId);
       playSong(player, deviceId, session.accessToken, trackId);
    }
  }, [trackId]); // Only fire when trackId changes explicitly

  const togglePlay = () => {
    if (player) {
      player.togglePlay();
    }
  };

  // Abstract Visualizer Bars
  const bars = Array.from({ length: 15 });

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto p-6 space-y-12">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-500">
          Modo Ciego
        </h2>
        <p className="text-slate-400 text-sm">Escucha y adivina. Sin pistas visuales.</p>
      </div>

      {error ? (
        <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-2xl w-full text-center">
          <p className="text-red-400 text-sm font-medium">{error}</p>
        </div>
      ) : !deviceId ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <Loader2 className="w-12 h-12 text-green-500 animate-spin" />
          <p className="text-slate-400 text-sm animate-pulse">Conectando con Spotify...</p>
        </div>
      ) : !hasStarted ? (
        <div className="flex flex-col items-center justify-center space-y-6">
           <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
               <Play className="w-8 h-8 text-green-400 ml-1" />
           </div>
           <p className="text-slate-300 text-center text-sm px-4">
             El reproductor web necesita permiso para lanzar el audio en este navegador.
           </p>
           <button
             onClick={() => {
               setHasStarted(true);
               if (session?.accessToken && deviceId && player) {
                  playSong(player, deviceId, session.accessToken, trackId);
               }
             }}
             className="px-8 py-4 bg-green-500 hover:bg-green-400 text-slate-900 font-bold rounded-full shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:shadow-[0_0_30px_rgba(34,197,94,0.5)] transition-all transform hover:scale-105"
           >
             Comenzar Reproducción
           </button>
        </div>
      ) : (
        <>
          {/* Abstract Sound Wave Visualizer */}
          <div className="flex items-end justify-center h-48 space-x-2 w-full max-w-[280px]">
            {bars.map((_, i) => (
              <motion.div
                key={i}
                className="w-3 rounded-full bg-gradient-to-t from-green-500 to-emerald-300"
                animate={{
                  height: !isPaused && isActive ? ["20%", "80%", "30%", "100%", "40%"] : "20%",
                  opacity: !isPaused && isActive ? [0.6, 1, 0.8] : 0.4,
                }}
                transition={{
                  duration: !isPaused && isActive ? Math.random() * 0.5 + 0.5 : 0.5,
                  repeat: Infinity,
                  repeatType: "reverse",
                  ease: "easeInOut",
                  delay: Math.random() * 0.2, // Random delay for chaotic wave effect
                }}
                style={{
                  minHeight: "12px",
                }}
              />
            ))}
          </div>

          {/* Controls */}
          <div className="flex flex-col items-center w-full space-y-8 mt-12">
            <button
              onClick={togglePlay}
              className="group relative flex items-center justify-center w-20 h-20 bg-green-500 hover:bg-green-400 rounded-full shadow-[0_0_30px_rgba(34,197,94,0.4)] hover:shadow-[0_0_40px_rgba(34,197,94,0.6)] transition-all duration-300 transform hover:scale-105"
            >
              <div className="absolute inset-0 rounded-full bg-white/20 scale-0 group-hover:scale-100 transition-transform duration-300 ease-out origin-center"></div>
              {isPaused ? (
                <Play className="w-10 h-10 text-slate-900 ml-2 relative z-10" />
              ) : (
                <Pause className="w-10 h-10 text-slate-900 relative z-10" />
              )}
            </button>

            <button
              onClick={onScanNext}
              className="flex items-center space-x-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-full border border-slate-700 transition-colors duration-200"
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
