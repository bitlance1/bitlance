import { MetadataRoute } from "next";
import { firebaseDb } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.bitlance.work";

  // Static routes
  const routes = [
    "",
    
    "/help",
    "/findwork",
    "/find-freelancers",
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: route === "" ? 1.0 : 0.8,
  }));

  // Dynamic job routes
  try {
    const jobsQuery = query(
      collection(firebaseDb, "jobs"),
      where("status", "==", "Open")
    );
    const jobsSnap = await getDocs(jobsQuery);
    
    const jobRoutes = jobsSnap.docs.map((docSnap) => {
      const data = docSnap.data();
      
      let lastModified = new Date();
      if (data.updatedAt && typeof data.updatedAt.toMillis === "function") {
        lastModified = new Date(data.updatedAt.toMillis());
      } else if (data.createdAt && typeof data.createdAt.toMillis === "function") {
        lastModified = new Date(data.createdAt.toMillis());
      } else if (data.updatedAt?.seconds) {
        lastModified = new Date(data.updatedAt.seconds * 1000);
      } else if (data.createdAt?.seconds) {
        lastModified = new Date(data.createdAt.seconds * 1000);
      }

      return {
        url: `${baseUrl}/job/${docSnap.id}`,
        lastModified,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      };
    });

    return [...routes, ...jobRoutes];
  } catch (error) {
    console.error("Failed to generate dynamic sitemap routes:", error);
    return routes;
  }
}
