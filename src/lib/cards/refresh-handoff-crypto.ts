import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

export type RefreshPair = { access: string; refresh: string; expires: number };
export type HandoffEnvelope = { v: 1; iv: string; tag: string; ciphertext: string };
function secret(name: string): Buffer | null {
  const raw = process.env[name];
  if (!raw || !/^[a-f0-9]{64}$/i.test(raw)) return null;
  return Buffer.from(raw, "hex");
}
export function refreshIdentity(token: string): string | null {
  const key = secret("SESSION_REFRESH_IDENTITY_KEY");
  if (!key || !token) return null;
  return createHmac("sha256", key).update("lt:auth:refresh:v1:").update(token).digest("hex");
}
export function encryptRefreshHandoff(id: string, pair: RefreshPair): HandoffEnvelope | null {
  const key = secret("SESSION_REFRESH_HANDOFF_KEY");
  if (!key || !/^[a-f0-9]{64}$/.test(id) || !pair.access || !pair.refresh ||
      !Number.isSafeInteger(pair.expires) || pair.expires < 60 || pair.expires > 86400) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from("lt:auth:refresh:v1:" + id));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(pair), "utf8"), cipher.final()]);
  return { v: 1, iv: iv.toString("base64url"), tag: cipher.getAuthTag().toString("base64url"), ciphertext: ciphertext.toString("base64url") };
}
export function decryptRefreshHandoff(id: string, envelope: HandoffEnvelope): RefreshPair | null {
  const key = secret("SESSION_REFRESH_HANDOFF_KEY");
  if (!key || !/^[a-f0-9]{64}$/.test(id) || !envelope || envelope.v !== 1) return null;
  try {
    const iv = Buffer.from(envelope.iv, "base64url");
    const tag = Buffer.from(envelope.tag, "base64url");
    if (iv.length !== 12 || tag.length !== 16) return null;
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(Buffer.from("lt:auth:refresh:v1:" + id));
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64url")), decipher.final()]);
    const parsed: unknown = JSON.parse(plain.toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const p = parsed as Record<string, unknown>;
    if (typeof p.access !== "string" || !p.access || p.access.length > 8192 ||
        typeof p.refresh !== "string" || !p.refresh || p.refresh.length > 8192 ||
        typeof p.expires !== "number" || !Number.isSafeInteger(p.expires) || p.expires < 60 || p.expires > 86400) return null;
    return { access: p.access, refresh: p.refresh, expires: p.expires };
  } catch { return null; }
}
