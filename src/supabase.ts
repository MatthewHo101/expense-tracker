import { createClient } from "@supabase/supabase-js";
// Supabase publishable keys are public client configuration, protected by RLS.
export const supabase = createClient(
  "https://gvhhursaczzhxkjeqtjd.supabase.co",
  "sb_publishable_ERd_Z-Nx1AwhdulMj6EpZw_TgDN3LMt",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
