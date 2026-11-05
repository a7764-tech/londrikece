import { createHmac, timingSafeEqual } from "node:crypto";

export const CASHIER_SESSION_COOKIE = "londri-kasier-session";
export const CASHIER_SESSION_MAX_AGE = 8 * 60 * 60;

function authConfiguration() {
  const username = process.env.CASHIER_USERNAME;
  const password = process.env.CASHIER_PASSWORD;
  const secret = process.env.AUTH_SECRET;
  if (!username || !password || !secret || Buffer.byteLength(secret) < 32) return null;
  return { username, password, secret };
}

function safeCompare(left: string, right: string) {
  const leftDigest = createHmac("sha256", "londri-kece-credential-check").update(left).digest();
  const rightDigest = createHmac("sha256", "londri-kece-credential-check").update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

export function isCashierAuthConfigured() {
  return authConfiguration() !== null;
}

export function verifyCashierCredentials(username: string, password: string) {
  const configuration = authConfiguration();
  if (!configuration) return false;
  return safeCompare(username, configuration.username) && safeCompare(password, configuration.password);
}

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createCashierSession(username: string) {
  const configuration = authConfiguration();
  if (!configuration) throw new Error("Autentikasi kasir belum dikonfigurasi.");
  const payload = Buffer.from(JSON.stringify({
    subject: createHmac("sha256", configuration.secret).update(username).digest("base64url"),
    credentialVersion: createHmac("sha256", configuration.secret).update(configuration.password).digest("base64url"),
    expiresAt: Math.floor(Date.now() / 1000) + CASHIER_SESSION_MAX_AGE,
  })).toString("base64url");
  return `${payload}.${sign(payload, configuration.secret)}`;
}

export function isValidCashierSession(token: string | undefined) {
  const configuration = authConfiguration();
  if (!configuration || !token) return false;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return false;
  const expected = sign(payload, configuration.secret);
  const signatureBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (signatureBytes.length !== expectedBytes.length || !timingSafeEqual(signatureBytes, expectedBytes)) return false;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      subject?: unknown;
      credentialVersion?: unknown;
      expiresAt?: unknown;
    };
    return session.subject === createHmac("sha256", configuration.secret).update(configuration.username).digest("base64url")
      && session.credentialVersion === createHmac("sha256", configuration.secret).update(configuration.password).digest("base64url")
      && typeof session.expiresAt === "number"
      && Number.isInteger(session.expiresAt)
      && session.expiresAt > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function isCashierAuthenticated(request: Request) {
  const prefix = `${CASHIER_SESSION_COOKIE}=`;
  const sessionCookie = request.headers.get("cookie")
    ?.split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix));
  return isValidCashierSession(sessionCookie?.slice(prefix.length));
}

export function unauthorizedCashierResponse() {
  return Response.json({ message: "Silakan login sebagai kasir untuk melanjutkan." }, {
    status: 401,
    headers: { "Cache-Control": "no-store" },
  });
}
