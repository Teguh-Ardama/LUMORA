import type { Config } from "tailwindcss";
import { lumoraPreset } from "@lumora/ui/tailwind-preset";

const config: Config = {
  presets: [lumoraPreset],
  content: ["./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
};

export default config;
