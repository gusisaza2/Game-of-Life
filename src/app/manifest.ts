import type { MetadataRoute } from "next";

// Makes the app installable: Chrome/Edge offer "Install Game of Life", and
// Safari's "Add to Dock" / the phone's "Add to Home Screen" pick up the name
// and icon. Colors match the app's mint background and teal accent.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Game of Life",
    short_name: "Game of Life",
    description: "A personal RPG for sustainable life growth.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#e9f9f0",
    theme_color: "#0d9488",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
