import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
  "http://localhost:54321";
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "your-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function isSupabaseConfigured() {
  return (
    Boolean(supabaseUrl) &&
    Boolean(supabaseAnonKey) &&
    !supabaseUrl.includes("seu-projeto") &&
    !supabaseAnonKey.includes("your-anon-key") &&
    !supabaseAnonKey.includes("sua-publishable-key")
  );
}
