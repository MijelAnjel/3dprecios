export interface TokenUser {
  uid:     string;
  email?:  string;
  name?:   string;
  picture?: string;
}

/** Verifica un Firebase ID Token (RS256 JWT) usando la Web Crypto API. */
export async function verifyFirebaseToken(
  token: string,
  projectId: string,
): Promise<TokenUser | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;

    // base64url → base64
    const b64 = (s: string) =>
      s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);

    const header  = JSON.parse(atob(b64(headerB64)))  as { kid: string; alg: string };
    const payload = JSON.parse(atob(b64(payloadB64))) as {
      sub: string; aud: string; iss: string;
      exp: number; email?: string; name?: string; picture?: string;
    };

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now)                                                          return null;
    if (payload.aud !== projectId)                                                   return null;
    if (payload.iss !== `https://securetoken.google.com/${projectId}`)               return null;
    if (!payload.sub)                                                                return null;

    // Obtener claves públicas de Firebase (Cloudflare CDN las cachea 1h)
    const keysRes = await fetch(
      'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
      { cf: { cacheTtl: 3600 } } as RequestInit,
    );
    if (!keysRes.ok) return null;

    const { keys } = (await keysRes.json()) as { keys: (JsonWebKey & { kid: string })[] };
    const jwk = keys.find((k) => k.kid === header.kid);
    if (!jwk) return null;

    const cryptoKey = await crypto.subtle.importKey(
      'jwk', jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false, ['verify'],
    );

    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const sig  = Uint8Array.from(atob(b64(signatureB64)), (c) => c.charCodeAt(0));
    const ok   = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, sig, data);
    if (!ok) return null;

    return { uid: payload.sub, email: payload.email, name: payload.name, picture: payload.picture };
  } catch {
    return null;
  }
}
