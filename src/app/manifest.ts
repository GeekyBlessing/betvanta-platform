import type { MetadataRoute } from "next";
/** Home-screen install details: BETVANTA's logo mark on black. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BETVANTA", short_name: "BETVANTA", description: "Sports analysis, daily picks and premium packages.",
    start_url: "/", display: "standalone", background_color: "#000000", theme_color: "#000000",
    icons: [
      { src: "/brand/betvanta-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/betvanta-icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/betvanta-icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
