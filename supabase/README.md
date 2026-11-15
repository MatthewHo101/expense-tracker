# Enable Jam family accounts

1. In your Supabase project, open **SQL Editor → New query**.
2. Paste the entire contents of [`setup.sql`](setup.sql) and select **Run**. It creates the family tables, row-level security, and authenticated functions. It is safe to rerun without deleting records.
3. In **Authentication → URL Configuration**, set Site URL to `https://mint-money-matthew.leapingmint2.chatgpt.site` and add `https://mint-money-matthew.leapingmint2.chatgpt.site/**` to allowed redirect URLs.
4. Enable the Email provider in **Authentication → Sign In / Providers**. Keep email confirmation enabled. For family members outside your Supabase organization, configure custom SMTP in Auth settings: Supabase's default development mail service only sends to authorized organization members and has tight rate limits. Use a sender/provider you control. Jam displays sign-up and reset errors instead of claiming mail was sent.
5. Open Jam, create your account, confirm your email, then create a family. Choose one family currency; combined totals never add different currencies together.
6. The owner generates an email-bound invitation link in the family dashboard. Share that link directly with the intended person. Links expire in seven days, work once, and must be accepted by an account with the same confirmed email.
7. Hosting access is separate from Supabase access. The Site is currently private. Family members need Site access too, or the owner can make the sign-in page publicly reachable. Database rows remain protected by Supabase auth and RLS either way.

## Data model and permissions

Each account belongs to one family. All members can read all family members' ledgers. Only the signed-in user can save their own ledger through `jam_save_state`; a caller cannot supply another user's ID. Only the owner can create invitations or change the shared monthly budget. Database tables allow no direct client writes. Invitation tokens are stored as hashes, bound to a confirmed email, and consumed under a row lock.

Personal state sync uses revision numbers: stale writes from another device are rejected instead of silently overwriting data. Family views refresh every 15 seconds and on window focus. Your own account refreshes automatically when there are no pending changes. Signing out clears in-memory family data. Offline changes stay in the open session until reconnection; export a backup before closing the tab if saving fails. The browser-only workspace remains separate and is never automatically uploaded.

The Supabase project URL and publishable key are intentionally public client configuration. No service-role key or database password is used by this app.
