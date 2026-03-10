"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Camera, AlertCircle } from "lucide-react";

interface ScannerProps {
  onScan: (trackId: string) => void;
}

export default function Scanner({ onScan }: ScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const qrCodeRegionId = "html5qr-code-full-region";

  const parseSpotifyLink = (url: string): string | null => {
    try {
      // Examples: 
      // spotify:track:4cOdK2wGLETKBW3PvgPWqT
      // https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT
      
      const uriMatch = url.match(/spotify:track:([a-zA-Z0-9]+)/);
      if (uriMatch && uriMatch[1]) return uriMatch[1];
      
      const urlMatch = url.match(/spotify\.com\/track\/([a-zA-Z0-9]+)/);
      if (urlMatch && urlMatch[1]) return urlMatch[1];

      return null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    // Setup and start scanner on mount
    const startScanner = async () => {
      try {
        const hasCamera = await Html5Qrcode.getCameras();
        if (hasCamera && hasCamera.length > 0) {
          scannerRef.current = new Html5Qrcode(qrCodeRegionId);
          setIsScanning(true);
          
          await scannerRef.current.start(
            { facingMode: "environment" },
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
              aspectRatio: 1.0,
            },
            (decodedText) => {
              const trackId = parseSpotifyLink(decodedText);
              if (trackId) {
                // Stop scanning when a valid link is found
                if (scannerRef.current?.isScanning) {
                  scannerRef.current.stop().then(() => {
                    setIsScanning(false);
                    onScan(trackId);
                  }).catch(console.error);
                }
              }
            },
            () => {
              // Ignore scan failures (happens on every frame without a QR code)
            }
          );
        } else {
          setError("No se encontraron cámaras disponibles en el dispositivo.");
        }
      } catch (err: any) {
        console.error("Error starting camera:", err);
        setError("Error al acceder a la cámara. Por favor, asegúrate de haber concedido los permisos.");
      }
    };

    startScanner();

    // Cleanup function
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, [onScan]);

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto p-4 space-y-6">
      <div className="flex flex-col items-center text-center space-y-2">
        <div className="p-3 bg-blue-500/20 rounded-full">
          <Camera className="w-8 h-8 text-blue-400" />
        </div>
        <h2 className="text-2xl font-bold text-slate-100">Escanea una Canción</h2>
        <p className="text-slate-400 text-sm">Apunta con la cámara a un código QR de Spotify o enlace de Lusi-Hits.</p>
      </div>

      <div className="relative w-full aspect-square max-w-[300px] overflow-hidden rounded-3xl border-2 border-slate-700/50 bg-slate-800 shadow-xl">
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-3 bg-red-500/10 backdrop-blur-sm">
            <AlertCircle className="w-10 h-10 text-red-400" />
            <p className="text-red-400 text-sm font-medium">{error}</p>
          </div>
        ) : (
          <div id={qrCodeRegionId} className="w-full h-full [&>video]:object-cover [&>video]:w-full [&>video]:h-full" />
        )}
        
        {/* Animated scanning line overlay */}
        {isScanning && !error && (
          <div className="absolute top-0 left-0 w-full h-[2px] bg-blue-400 shadow-[0_0_10px_2px_rgba(96,165,250,0.5)] animate-[scan_2s_ease-in-out_infinite]" />
        )}
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scan {
          0% { transform: translateY(0); }
          50% { transform: translateY(300px); }
          100% { transform: translateY(0); }
        }
        #html5qr-code-full-region span { display: none !important; }
      `}} />
    </div>
  );
}
