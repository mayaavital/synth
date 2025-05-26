import { Stack } from "expo-router/stack";
import { ErrorBoundary } from "../utils/ErrorBoundary";
import { SpotifyAuthProvider } from "../utils/SpotifyAuthContext";

export default function Layout() {
  return (
    <ErrorBoundary>
      <SpotifyAuthProvider>
        <Stack />
      </SpotifyAuthProvider>
    </ErrorBoundary>
  );
}
