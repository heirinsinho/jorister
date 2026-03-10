"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

interface ScriptContextType {
  isReady: boolean;
}

const ScriptContext = createContext<ScriptContextType>({ isReady: false });

export const useSpotifyWebPlaybackSDK = () => useContext(ScriptContext);

export const SpotifyScriptProvider = ({ children }: { children: React.ReactNode }) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Check if the script is already loaded
    if (window.Spotify) {
      setIsReady(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;

    // The SDK calls window.onSpotifyWebPlaybackSDKReady when it's ready
    window.onSpotifyWebPlaybackSDKReady = () => {
      setIsReady(true);
    };

    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return <ScriptContext.Provider value={{ isReady }}>{children}</ScriptContext.Provider>;
};
