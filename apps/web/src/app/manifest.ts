import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ORVELIA",
    short_name: "ORVELIA",
    description: "Todo lo que posees, en un solo espacio inteligente.",
    start_url: "/app",
    display: "standalone",
    background_color: "#111315",
    theme_color: "#111315",
    lang: "es",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
