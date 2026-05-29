import { NextResponse } from "next/server";
import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";

const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;
const DEFAULT_FIREBASE_WEB_API_KEY = "AIzaSyCr_rWHnm0w79J63dm69DEMkjawulE5Ovk";

async function getUidFromIdToken(authHeader: string | null): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const idToken = authHeader.slice("Bearer ".length).trim();
  if (!idToken) return null;

  const firebaseApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || DEFAULT_FIREBASE_WEB_API_KEY;
  const verifyResponse = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    },
  );
  if (!verifyResponse.ok) return null;
  const verifyData = (await verifyResponse.json()) as { users?: Array<{ localId?: string }> };
  return verifyData.users?.[0]?.localId ?? null;
}

export async function POST(request: Request) {
  try {
    const uid = await getUidFromIdToken(request.headers.get("authorization"));
    if (!uid) return NextResponse.json({ error: "Unauthorized upload request." }, { status: 401 });

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json({ error: "Cloudinary environment variables are missing." }, { status: 500 });
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file attached." }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: "File is larger than 100MB." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const safeName = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);
    const publicId = `${randomUUID()}_${safeName || "file"}`;

    const uploadResult = await new Promise<UploadApiResponse>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `bitlance/chat/${uid}`,
          public_id: publicId,
          resource_type: "auto",
          filename_override: file.name,
          overwrite: false,
        },
        (error, result) => {
          if (error || !result) {
            reject(error ?? new Error("Upload failed."));
            return;
          }
          resolve(result);
        },
      );
      Readable.from(buffer).pipe(uploadStream);
    });

    return NextResponse.json({
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      bytes: uploadResult.bytes,
      mimeType: file.type,
      resourceType: uploadResult.resource_type,
      name: file.name,
    });
  } catch (error) {
    console.error("Chat upload error:", error);
    return NextResponse.json({ error: "Failed to upload file." }, { status: 500 });
  }
}
