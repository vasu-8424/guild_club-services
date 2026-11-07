import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.guildclub.services",
  appName: "Guild Club Services",
  webDir: "public",
  server: {
    url: "https://guildclub-services.vercel.app",
    cleartext: false,
    androidScheme: "https",
  },
  plugins: {
    StatusBar: {
      overlaysWebView: false,
      style: "DARK",
      backgroundColor: "#FFFFFF",
    },
  },
};

export default config;
