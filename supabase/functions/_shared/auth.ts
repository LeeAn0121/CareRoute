// Ask the Auth server; never authorize from decoded JWT claims. Compatible with
// asymmetric user JWTs when the gateway uses --no-verify-jwt.
export async function authenticateGoogleUser(req: Request): Promise<boolean> {
  const base = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const bearer = req.headers.get("Authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!base || !anonKey || !bearer || bearer === anonKey) return false;
  try {
    const response = await fetch(`${base}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${bearer}` },
      cache: "no-store",
    });
    if (!response.ok) return false;
    const user = await response.json();
    return typeof user?.id === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id) &&
      typeof user.email === "string" && !!user.email_confirmed_at &&
      !user.is_anonymous && !user.deleted_at &&
      (!user.banned_until || Date.parse(user.banned_until) <= Date.now()) &&
      Array.isArray(user.identities) &&
      user.identities.some((identity: { provider?: string }) => identity.provider === "google");
  } catch {
    return false;
  }
}
