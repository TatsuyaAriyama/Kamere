import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.kamere.app",
  appName: "Kamere",
  webDir: "dist",
  ios: {
    contentInset: "never",
  },
};

export default config;
