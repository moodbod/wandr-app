import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wandr",
    short_name: "Wandr",
    description: "Local travel picks and routes.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // DO NOT CHANGE — must match bg-card (#fff) to avoid a visible strip behind the iPhone home indicator
    background_color: "#ffffff",
    theme_color: "#9fe870",
    categories: ["travel", "navigation", "lifestyle"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
