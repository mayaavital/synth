import { Stack } from "expo-router/stack";
import { ErrorBoundary } from "../utils/ErrorBoundary";

export default function Layout() {
  return (
    <ErrorBoundary>
      <Stack />
    </ErrorBoundary>
  );
}
