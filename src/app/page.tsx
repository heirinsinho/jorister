"use client";

import { LogIn, LogOut, PlayCircle } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";

export default function Home() {
	const { data: session, status } = useSession();
	const router = useRouter();

	const handleLogin = () => {
		signIn("spotify");
	};

	const handleLogout = () => {
		signOut();
	};

	return (
		<main className="flex min-h-screen flex-col items-center justify-center p-6 bg-[var(--color-background)] text-slate-100">
			<div className="flex w-full max-w-3xl flex-col items-center justify-center space-y-8 rounded-3xl border border-transparent bg-[var(--color-background)] p-10">
				<div className="flex flex-col items-center space-y-2">
					<div className="relative mb-4 h-[190px] w-[min(88vw,640px)] transition-transform duration-500 hover:scale-105 sm:h-[230px]">
						<Image
							src="/logo-transparent.png"
							alt="jorister Logo"
							fill
							className="object-contain"
							priority
						/>
					</div>
					<h1 className="sr-only">jorister Blind</h1>
					<p className="text-slate-400 text-center text-lg leading-relaxed max-w-xs">
						El juego de música en el que Joram también gana siempre.
					</p>
				</div>

				{status === "loading" ? (
					<div className="w-full flex justify-center py-4">
						<div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
					</div>
				) : session ? (
					<div className="flex w-full max-w-md flex-col items-center space-y-6">
						<div className="bg-slate-700/30 px-6 py-3 rounded-full flex items-center space-x-3 border border-slate-600/50">
							<div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
							<p className="text-sm font-medium text-slate-200">
								Conectado como{" "}
								<span className="text-green-400 font-bold">
									{session.user?.name}
								</span>
							</p>
						</div>

						<button
							type="button"
							onClick={() => router.push("/play")}
							className="group relative w-full flex justify-center py-4 px-4 border border-transparent rounded-2xl text-lg font-bold text-slate-900 bg-green-500 hover:bg-green-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-300 transform hover:scale-[1.02] shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:shadow-[0_0_30px_rgba(34,197,94,0.5)] overflow-hidden"
						>
							<div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
							<span className="relative flex items-center space-x-2">
								<PlayCircle className="w-6 h-6" />
								<span>Comenzar Juego</span>
							</span>
						</button>

						<button
							type="button"
							onClick={handleLogout}
							className="text-sm flex items-center space-x-2 text-slate-500 hover:text-red-400 transition-colors duration-200 py-2"
						>
							<LogOut className="w-4 h-4" />
							<span>Cerrar sesión</span>
						</button>
					</div>
				) : (
					<div className="flex w-full max-w-md flex-col items-center space-y-4">
						<button
							type="button"
							onClick={handleLogin}
							className="group w-full flex items-center justify-center space-x-3 py-4 px-4 border border-transparent rounded-2xl text-lg font-bold text-white bg-[#1DB954] hover:bg-[#1ed760] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1DB954] transition-all duration-300 transform hover:scale-[1.02] shadow-[0_0_20px_rgba(29,185,84,0.3)] hover:shadow-[0_0_30px_rgba(29,185,84,0.5)]"
						>
							<LogIn className="w-6 h-6 group-hover:animate-pulse" />
							<span>Login con Spotify</span>
						</button>
						<p className="text-xs text-slate-500 text-center max-w-[250px]">
							Requiere una cuenta de Spotify Premium para reproducir la música.
						</p>
					</div>
				)}
			</div>
		</main>
	);
}
