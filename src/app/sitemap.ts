import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const now = new Date();

  return [
    { url: base, lastModified: now },
    { url: `${base}/login`, lastModified: now },
    { url: `${base}/register`, lastModified: now },
    { url: `${base}/termos`, lastModified: now },
    { url: `${base}/privacidade`, lastModified: now },
  ];
}
