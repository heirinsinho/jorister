import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";
import { SpotifyScriptProvider } from "@/components/SpotifyScriptProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
	title: "Jorister",
	description: "Un reproductor ciego de Spotify para jugar a Lushits",
	icons: {
		icon: "/favicon.ico",
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="es">
			<body className={`${inter.className} min-h-screen text-slate-50 antialiased`}>
				<AuthProvider>
					<SpotifyScriptProvider>{children}</SpotifyScriptProvider>
				</AuthProvider>
			</body>
		</html>
	);
}
