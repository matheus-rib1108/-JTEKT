import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/register", "/termos", "/privacidade"],
        // Authenticated areas have nothing to index and shouldn't be crawled.
        disallow: ["/admin", "/portal", "/api"],
      },
    ],
  };
}
