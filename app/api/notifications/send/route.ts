import { createSign } from "crypto";
import { NextResponse } from "next/server";

type NotificationRequest = {
  userId?: string;
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
};

type TokenDoc = {
  name?: string;
  fields?: {
    token?: { stringValue?: string };
    userId?: { stringValue?: string };
  };
};

const FIREBASE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const FIRESTORE_SCOPE = "https://www.googleapis.com/auth/datastore";

const projectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
  "bitlance-761eb";
const firebaseWebApiKey =
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
  "AIzaSyCr_rWHnm0w79J63dm69DEMkjawulE5Ovk";

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

const base64Url = (input: string | Buffer) =>
  Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const getServiceAccount = () => {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (rawJson) {
    const parsed = JSON.parse(rawJson.replace(/^['"]|['"]$/g, ""));
    return {
      clientEmail: parsed.client_email as string,
      privateKey: (parsed.private_key as string).replace(/\\n/g, "\n"),
    };
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) return null;
  return { clientEmail, privateKey };
};

const getRequesterUid = async (authHeader: string | null) => {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const idToken = authHeader.slice("Bearer ".length).trim();
  if (!idToken) return null;

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseWebApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
      cache: "no-store",
    }
  );

  if (!response.ok) return null;
  const data = (await response.json()) as { users?: Array<{ localId?: string }> };
  return data.users?.[0]?.localId ?? null;
};

const getAccessToken = async () => {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && cachedAccessToken.expiresAt - 60 > now) {
    return cachedAccessToken.token;
  }

  const serviceAccount = getServiceAccount();
  if (!serviceAccount) {
    throw new Error("Firebase service account env vars are missing.");
  }

  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({
      iss: serviceAccount.clientEmail,
      scope: `${FCM_SCOPE} ${FIRESTORE_SCOPE}`,
      aud: FIREBASE_TOKEN_URL,
      exp: now + 3600,
      iat: now,
    })
  );
  const unsigned = `${header}.${payload}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(serviceAccount.privateKey);
  const assertion = `${unsigned}.${base64Url(signature)}`;

  const response = await fetch(FIREBASE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  const data = (await response.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!response.ok || !data.access_token) {
    throw new Error(data.error || "Unable to authorize Firebase notification sender.");
  }

  cachedAccessToken = {
    token: data.access_token,
    expiresAt: now + Number(data.expires_in ?? 3600),
  };
  return data.access_token;
};

const getUserTokens = async (accessToken: string, userId: string) => {
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "notification_tokens" }],
          where: {
            fieldFilter: {
              field: { fieldPath: "userId" },
              op: "EQUAL",
              value: { stringValue: userId },
            },
          },
          limit: 20,
        },
      }),
    }
  );

  const data = (await response.json()) as Array<{ document?: TokenDoc }>;
  if (!response.ok) throw new Error("Unable to load notification tokens.");

  return data
    .map((row) => ({
      name: row.document?.name,
      token: row.document?.fields?.token?.stringValue,
    }))
    .filter((row): row is { name: string; token: string } => Boolean(row.name && row.token));
};

const deleteTokenDoc = async (accessToken: string, docName: string) => {
  await fetch(`https://firestore.googleapis.com/v1/${docName}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  }).catch(() => {});
};

const sendToToken = async (
  accessToken: string,
  token: string,
  payload: Required<Pick<NotificationRequest, "title" | "body">> &
    Pick<NotificationRequest, "url" | "tag">
) => {
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        token,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: {
          title: payload.title,
          body: payload.body,
          url: payload.url || "/",
          tag: payload.tag || payload.url || payload.title,
        },
        webpush: {
          fcmOptions: {
            link: payload.url || "/",
          },
        },
      },
    }),
  });

  if (response.ok) return { ok: true, stale: false };

  const data = (await response.json().catch(() => null)) as {
    error?: { status?: string; details?: Array<{ errorCode?: string }> };
  } | null;
  const errorCode = data?.error?.details?.[0]?.errorCode;
  const stale =
    data?.error?.status === "NOT_FOUND" ||
    errorCode === "UNREGISTERED" ||
    errorCode === "INVALID_ARGUMENT";

  return { ok: false, stale };
};

export async function POST(request: Request) {
  try {
    const requesterUid = await getRequesterUid(request.headers.get("authorization"));
    if (!requesterUid) {
      return NextResponse.json({ error: "Unauthorized notification request." }, { status: 401 });
    }

    const payload = (await request.json()) as NotificationRequest;
    if (!payload.userId || !payload.title || !payload.body) {
      return NextResponse.json({ error: "Missing userId, title, or body." }, { status: 400 });
    }
    const notification = {
      title: payload.title,
      body: payload.body,
      url: payload.url,
      tag: payload.tag,
    };

    const accessToken = await getAccessToken();
    const tokens = await getUserTokens(accessToken, payload.userId);
    if (!tokens.length) {
      return NextResponse.json({ ok: true, sent: 0 });
    }

    const results = await Promise.all(
      tokens.map(async ({ name, token }) => {
        const result = await sendToToken(accessToken, token, notification);
        if (result.stale) await deleteTokenDoc(accessToken, name);
        return result;
      })
    );

    return NextResponse.json({
      ok: true,
      sent: results.filter((result) => result.ok).length,
      removed: results.filter((result) => result.stale).length,
    });
  } catch (error) {
    console.error("Notification send error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to send notification." },
      { status: 500 }
    );
  }
}
