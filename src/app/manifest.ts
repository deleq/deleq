import type { MetadataRoute } from "next";
import { BRAND } from "@/config/brand";

// Install metadata with the placeholder tile (blue ground, readable on light and dark home screens).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND.name}: ${BRAND.slogan.replace(/\.$/, "")}`,
    short_name: BRAND.name,
    description: `Agent permissions and spending limits on ${BRAND.chainName}.`,
    start_url: "/",
    display: "standalone",
    background_color: "#1c2324",
    theme_color: "#1c2324",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
