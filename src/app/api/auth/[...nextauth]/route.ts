import NextAuth from "next-auth"
import SpotifyProvider from "next-auth/providers/spotify"
import { JWT } from "next-auth/jwt"

// Define un alcance amplio para Spotify
const scopes = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-modify-playback-state",
  "user-read-playback-state"
].join(" ");

const params = new URLSearchParams()
params.append('scope', scopes);

export const authOptions = {
  providers: [
    SpotifyProvider({
      clientId: process.env.SPOTIFY_CLIENT_ID as string,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET as string,
      authorization: `https://accounts.spotify.com/authorize?${params.toString()}&show_dialog=true`,
    }),
  ],
  callbacks: {
    async jwt({ token, account }: { token: JWT; account: any }) {
      // Al iniciar sesión de nuevo, guarda el token de acceso inicial a Token
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }: { session: any; token: JWT }) {
      // Envía access_token al cliente para ser usado en el Spotify SDK
      session.accessToken = token.accessToken;
      return session;
    },
  },
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
