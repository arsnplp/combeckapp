import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Client Supabase côté serveur uniquement (service_role — bypass RLS).
// Ne JAMAIS importer ce module dans un composant client.
let _client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis dans .env.local");
  }
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}
