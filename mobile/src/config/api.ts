import { Platform } from "react-native";

/**
 * In dev we need different hosts depending on the platform:
 *   - Android emulator: 10.0.2.2 maps to the host machine's localhost
 *   - iOS simulator / web: localhost works fine
 *
 * In production this would come from an env variable or config service.
 */
const DEV_HOST = Platform.OS === "android" ? "10.0.2.2" : "localhost";

export const API_BASE_URL = __DEV__
  ? `http://${DEV_HOST}:3000`
  : "https://api.example.com";
