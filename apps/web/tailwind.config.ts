import type { Config } from "tailwindcss";
import uiPreset from "@wapp/ui/tailwind.preset";

const config: Config = {
  presets: [uiPreset],
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}", // shared components must be scanned too, or their classes get purged
  ],
};

export default config;
