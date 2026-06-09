import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.bitlance.work";

  return {
    rules: {
      userAgent: "*",
      allow: [
        "/",
        "/help",
        "/findwork",
        "/find-freelancers",
        "/job/",
      ],
      disallow: [
        "/client/",
        "/freelancer/",
        "/admin/",
        "/api/",
        "/login",
        "/signup",
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
