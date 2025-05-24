import { useEffect } from "react";
import { Platform } from "react-native";

export default function App({ Component, pageProps }) {
  useEffect(() => {
    // Add any global initialization here
    if (Platform.OS === "web") {
      // Web-specific initialization
    }
  }, []);

  return <Component {...pageProps} />;
}
