// Microsoft sign-in for Outlook.com mail, with the device code flow: Yami
// shows a short code, you enter it at microsoft.com/link in your browser,
// and Microsoft hands Yami a token for reading mail over IMAP. Yami never
// sees your password. It needs an app (client) ID registered as a public
// client; the owner's or your own, kept in Settings.

export const microsoftScope =
  "https://outlook.office.com/IMAP.AccessAsUser.All offline_access openid email";
const base = "https://login.microsoftonline.com/common/oauth2/v2.0";

export type DeviceCode = {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresAt: number;
  interval: number;
};
export type MicrosoftTokens = {
  access: string;
  refresh: string;
  expiresAt: number;
  /** The signed-in address, from the ID token. */
  user?: string;
};

export function validClientId(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id.trim(),
  );
}

async function post(
  fetcher: typeof fetch,
  url: string,
  body: Record<string, string>,
) {
  const response = await fetcher(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(15000),
  });
  const json: any = await response.json().catch(() => ({}));
  return { ok: response.ok, json };
}

export async function startDeviceCode(
  clientId: string,
  fetcher: typeof fetch = fetch,
): Promise<DeviceCode> {
  if (!validClientId(clientId))
    throw new Error(
      "Add a Microsoft app (client) ID in Settings › Connections first.",
    );
  const { ok, json } = await post(fetcher, `${base}/devicecode`, {
    client_id: clientId.trim(),
    scope: microsoftScope,
  });
  if (!ok || !json.device_code)
    throw new Error(
      json.error_description?.split("\r\n")[0] ||
        "Microsoft did not start the sign-in.",
    );
  return {
    deviceCode: json.device_code,
    userCode: json.user_code,
    verificationUri: json.verification_uri || "https://microsoft.com/link",
    expiresAt: Date.now() + Number(json.expires_in || 900) * 1000,
    interval: Math.max(1, Number(json.interval || 5)),
  };
}

/** The address in an ID token; it is read, not trusted for anything else. */
export function idTokenUser(idToken: string | undefined) {
  try {
    const claims = JSON.parse(
      Buffer.from(String(idToken).split(".")[1], "base64url").toString("utf8"),
    );
    return String(claims.email || claims.preferred_username || "") || undefined;
  } catch {
    return undefined;
  }
}

function tokens(json: any): MicrosoftTokens {
  return {
    access: String(json.access_token),
    refresh: String(json.refresh_token || ""),
    expiresAt: Date.now() + (Number(json.expires_in || 3600) - 60) * 1000,
    user: idTokenUser(json.id_token),
  };
}

/** Waits until the code is entered, refused or expired. */
export async function waitForDeviceCode(
  clientId: string,
  code: DeviceCode,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
  sleep = (ms: number) => new Promise((r) => setTimeout(r, ms)),
): Promise<MicrosoftTokens> {
  let interval = code.interval;
  while (Date.now() < code.expiresAt) {
    await sleep(interval * 1000);
    if (signal.aborted) throw new Error("Sign-in cancelled.");
    const { ok, json } = await post(fetcher, `${base}/token`, {
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      client_id: clientId.trim(),
      device_code: code.deviceCode,
    });
    if (ok && json.access_token) return tokens(json);
    if (json.error === "authorization_pending") continue;
    if (json.error === "slow_down") {
      interval += 5;
      continue;
    }
    throw new Error(
      json.error === "authorization_declined"
        ? "The sign-in was declined."
        : json.error === "expired_token"
          ? "The code expired. Start again."
          : json.error_description?.split("\r\n")[0] ||
            "Microsoft refused the sign-in.",
    );
  }
  throw new Error("The code expired. Start again.");
}

export async function refreshMicrosoft(
  clientId: string,
  refresh: string,
  fetcher: typeof fetch = fetch,
): Promise<MicrosoftTokens> {
  const { ok, json } = await post(fetcher, `${base}/token`, {
    grant_type: "refresh_token",
    client_id: clientId.trim(),
    refresh_token: refresh,
    scope: microsoftScope,
  });
  if (!ok || !json.access_token)
    throw new Error(
      "Microsoft sign-in expired. Remove the account and add it again.",
    );
  const next = tokens(json);
  return { ...next, refresh: next.refresh || refresh };
}

/** The SASL XOAUTH2 string IMAP servers expect. */
export function xoauth2(user: string, access: string) {
  return Buffer.from(
    `user=${user}\x01auth=Bearer ${access}\x01\x01`,
    "utf8",
  ).toString("base64");
}
