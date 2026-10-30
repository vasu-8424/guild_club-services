import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.guildclub.services",
  appName: "Guild Club Services",
  webDir: "public",
  server: {
    // DEBUG/PROTOTYPE ONLY: Points to the live hosted application for mobile evaluation.
    // NOTE: In production releases, Capacitor recommends local assets or verified domains.
    url: "https://guildclub-services.vercel.app/",
    cleartext: false,
    androidScheme: "https",
  },
};

export default config;

