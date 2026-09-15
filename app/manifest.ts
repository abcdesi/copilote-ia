import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pilotzia",
    short_name: "Pilotzia",
    description: "Le système opérationnel IA qui comprend votre entreprise et agit dessus.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#17161c",
    lang: "fr",
  };
}
