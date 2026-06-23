import { NextResponse } from "next/server";
import { Resend } from "resend";

const FIREBASE_WEB_API_KEY =
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyCr_rWHnm0w79J63dm69DEMkjawulE5Ovk";

type NotificationRequest = {
  userId?: string;
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
};

// ── Verify sender's Firebase ID token and return their UID ───────────────────
async function getRequesterUid(authHeader: string | null): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const idToken = authHeader.slice("Bearer ".length).trim();
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_WEB_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
        cache: "no-store",
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { users?: Array<{ localId?: string }> };
    return data.users?.[0]?.localId ?? null;
  } catch {
    return null;
  }
}

// ── Get a user's email via Firebase Auth REST API ────────────────────────────
// We use the service account to mint a custom token, then exchange it for an
// ID token so we can call accounts:lookup for any UID.
// Simpler alternative: call accounts:lookup with the target user's UID directly
// using the server's own privileged lookup endpoint.
async function getUserEmail(targetUid: string): Promise<string | null> {
  try {
    // Use Firebase Admin REST endpoint that accepts a service account access token.
    // To avoid firebase-admin SDK, we call the Identity Toolkit v1 admin endpoint
    // with a Google OAuth2 access token derived from the service account key.
    const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountRaw) return null;

    const sa = JSON.parse(serviceAccountRaw) as {
      client_email: string;
      private_key: string;
      project_id: string;
    };

    // Mint a JWT to exchange for a Google access token
    const accessToken = await getGoogleAccessToken(sa.client_email, sa.private_key);
    if (!accessToken) return null;

    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/projects/${sa.project_id}/accounts:lookup`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ localId: [targetUid] }),
        cache: "no-store",
      }
    );

    if (!res.ok) return null;
    const data = (await res.json()) as { users?: Array<{ email?: string }> };
    return data.users?.[0]?.email ?? null;
  } catch {
    return null;
  }
}

// ── Mint a short-lived Google OAuth2 access token from a service account ─────
async function getGoogleAccessToken(
  clientEmail: string,
  privateKeyPem: string
): Promise<string | null> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: "RS256", typ: "JWT" };
    const payload = {
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    };

    const encode = (obj: object) =>
      Buffer.from(JSON.stringify(obj)).toString("base64url");

    const signingInput = `${encode(header)}.${encode(payload)}`;

    // Import the private key and sign
    const keyData = privateKeyPem
      .replace(/-----BEGIN PRIVATE KEY-----/, "")
      .replace(/-----END PRIVATE KEY-----/, "")
      .replace(/\n/g, "");

    const binaryKey = Buffer.from(keyData, "base64");
    const cryptoKey = await crypto.subtle.importKey(
      "pkcs8",
      binaryKey,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      Buffer.from(signingInput)
    );

    const jwt = `${signingInput}.${Buffer.from(signature).toString("base64url")}`;

    // Exchange JWT for access token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    if (!tokenRes.ok) return null;
    const tokenData = (await tokenRes.json()) as { access_token?: string };
    return tokenData.access_token ?? null;
  } catch {
    return null;
  }
}

// ── Send email via Resend ─────────────────────────────────────────────────────
async function sendEmail(
  toEmail: string,
  payload: { title: string; body: string; url?: string }
): Promise<{ ok: boolean; error?: string }> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bitlance.work";
  const actionUrl = payload.url ? `${siteUrl}${payload.url}` : siteUrl;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${payload.title}</title>
</head>
<body style="margin:0;padding:0;background-color:#FCF9F7;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FCF9F7;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #F0EBE3;overflow:hidden;">
          <tr>
            <td style="background-color:#1a2332;padding:24px 32px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:36px;height:36px;background:#F7931A;border-radius:10px;text-align:center;vertical-align:middle;overflow:hidden;">
                    <img src="${siteUrl}/assets/logo.png" alt="Bitlance" width="28" height="28" style="display:block;margin:4px auto;object-fit:contain;" />
                  </td>
                  <td style="padding-left:12px;">
                    <span style="color:#ffffff;font-size:16px;font-weight:900;letter-spacing:-0.3px;">Bitlance</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 12px 0;font-size:20px;font-weight:900;color:#1a1a1a;line-height:1.3;">${payload.title}</h1>
              <p style="margin:0 0 28px 0;font-size:14px;color:#555;line-height:1.6;">${payload.body.replace(/\n/g, "<br/>")}</p>
              ${payload.url ? `<a href="${actionUrl}" style="display:inline-block;background:#F7931A;color:#ffffff;font-size:13px;font-weight:900;text-decoration:none;padding:12px 28px;border-radius:100px;letter-spacing:0.04em;text-transform:uppercase;">View on Bitlance</a>` : ""}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #F0EBE3;">
              <p style="margin:0;font-size:11px;color:#B0A89E;line-height:1.5;">
                You received this because you have a Bitlance account.<br/>
                <a href="${siteUrl}" style="color:#F7931A;text-decoration:none;">bitlance.work</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const fromAddress = process.env.RESEND_FROM_EMAIL ?? "Bitlance <onboarding@resend.dev>";

  const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
    from: fromAddress,
    to: toEmail,
    subject: payload.title,
    html,
  });

  if (error) {
    console.error("[Resend] error:", error);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

// ── POST handler ──────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const requesterUid = await getRequesterUid(request.headers.get("authorization"));
    if (!requesterUid) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const payload = (await request.json()) as NotificationRequest;
    if (!payload.userId || !payload.title || !payload.body) {
      return NextResponse.json({ error: "Missing userId, title, or body." }, { status: 400 });
    }

    const toEmail = await getUserEmail(payload.userId);
    if (!toEmail) {
      return NextResponse.json({ error: "User email not found." }, { status: 404 });
    }

    const result = await sendEmail(toEmail, {
      title: payload.title,
      body: payload.body,
      url: payload.url,
    });

    return NextResponse.json({ ok: result.ok, sent: result.ok ? 1 : 0, error: result.error });
  } catch (error) {
    console.error("Notification send error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to send notification." },
      { status: 500 }
    );
  }
}
