# Mustang Pantry

A static web app using Supabase Auth, Postgres, and Realtime to manage pantry stock. Photos use the existing Cloudinary upload configuration in `app.js`.

## Connect Supabase

1. Create a project at [Supabase](https://supabase.com/dashboard). Wait for provisioning to finish.
2. Open **SQL Editor → New query**, paste all of [`supabase/schema.sql`](supabase/schema.sql), and click **Run**. This creates the inventory table, database access policies, and Realtime subscription setup. Run this before using the app; committing SQL to GitHub does not apply it to Supabase.
3. Open the project's **Connect** dialog and copy the **Project URL** and **publishable key** (also available in project settings). Edit [`supabase-config.js`](supabase-config.js):

   ```js
   export const supabaseUrl = 'https://YOUR_PROJECT_REF.supabase.co';
   export const supabasePublishableKey = 'sb_publishable_...';
   ```

   These values are public browser configuration and may be committed for your deployed site. A legacy `anon` key also works. **Never use a secret key, `service_role` key, database password, or connection string in this file.** Database policies enforce permissions.
4. Under **Authentication → Sign In / Providers → Email**, enable email/password sign-in and keep **Confirm email** enabled.
5. Under **Authentication → URL Configuration**, set the **Site URL** to your deployed site, or `http://localhost:3000/` for local development. Add these exact **Redirect URLs** as needed:

   ```text
   http://localhost:3000/
   https://smoooww.github.io/food-rescue/
   ```

   Use your actual URL, including a repository subpath and trailing slash. If your local server chooses a different port, add that URL too. The app sends its current directory URL with confirmation emails.
6. Configure **Authentication → SMTP Settings** with your email provider before inviting students. Supabase's default mail service is restricted to project-team email addresses and has low limits; arbitrary `@calpoly.edu` addresses need custom SMTP. See [Supabase SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp).
7. Start the app locally (Node.js required):

   ```bash
   npx serve . -l 3000
   ```

   Open `http://localhost:3000`. Do not double-click `index.html`; browser modules require an HTTP server.
8. Click **Create account** using a real `@calpoly.edu` email. Open the confirmation email, then sign in. If the link opens another browser, return to the original browser and sign in there. **Resend email** is available after signup or an unconfirmed sign-in attempt.

## Staff access

The configured staff account is `pantry-staff@calpoly.edu`. For a demo, create this account in Supabase Authentication → Users with a private password and auto-confirm its email. This does not create a real email inbox. The account can add items, adjust stock and remove items. Do not publish its password. For production, use a staff mailbox you control. Ordinary confirmed Cal Poly accounts can only read inventory.

To use a different staff mailbox, update both `pantryStaffEmails` in `app.js` and the staff email in `supabase/schema.sql`, then rerun the SQL. Use a real Cal Poly address. Changing only the frontend does not grant database access. SQL checks confirmation for staff as well as students.

The UI limits signup to Cal Poly addresses. Direct API signup can still create other Auth accounts, but database policies deny them inventory access.

## Verify the connection

- Create and confirm a student account; check that it can browse but cannot manage stock.
- Sign in as the confirmed staff account; add an item, change its stock level, and remove it.
- Keep a student session open in a separate browser and check that inventory updates appear.
- Reload the page and confirm that your session and saved items persist.
- Sign out and confirm that inventory disappears.

Realtime changes refresh the list automatically, with a 30-second fallback refresh. If data fails to load, check that the SQL ran successfully, the account is confirmed, and the URL/key belong to the same project. For email problems, check SMTP, redirect URLs, and Auth logs. Photos still require the existing Cloudinary unsigned upload preset to be enabled.

## Publish with GitHub Pages

1. Commit the code with your public Supabase configuration.
2. In GitHub, open **Settings → Pages → Deploy from a branch**.
3. Select `main` and `/ (root)` and save.
4. Add the resulting site URL to Supabase's Site URL and Redirect URLs as described above.

This is a static site; there is no build step, Firebase deployment, or server-side `.env` loading.

## Existing Firebase data

This code change does not copy or delete your existing Firebase project, accounts, or Firestore documents. New Supabase projects start with an empty inventory, and users need new Supabase accounts. Export and import old inventory separately if you need to retain it. The SQL uses the existing camelCase listing fields, but new IDs are UUIDs, so omit old Firestore IDs when importing. Keep the Firebase project until any needed data has been migrated and checked.

## References

- [Supabase JavaScript client](https://supabase.com/docs/reference/javascript/initializing)
- [Email signup and confirmation](https://supabase.com/docs/reference/javascript/auth-signup)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Realtime database changes](https://supabase.com/docs/guides/realtime/postgres-changes)

## Local code checks

```bash
node tests/app.test.mjs
node --input-type=module --check < app.js
```

The controller tests use a mocked Supabase client; they do not verify live email delivery, database policies, or Realtime. Complete the connection checks above against your project before release.

## Files to keep

- `index.html` and `styles.css`: website layout and styling.
- `app.js`, `supabase-client.js`, and `supabase-config.js`: app behavior and Supabase connection.
- `supabase/schema.sql`: database setup and access policies. It is not loaded by the website, but keep it to recreate the database or update administrator permissions. Editing this file only takes effect after running it in Supabase.
- `tests/app.test.mjs`: local regression checks.
- `README.md` and `.gitignore`: setup documentation and Git configuration.

The local `.agents/` directory contains editor/agent tooling, not website code.

Inventory stays visible across days until staff removes it. The `stockDate` column records when an item was added; it no longer limits visibility. Previously hidden items will reappear, including separate copies made with the old daily-copy feature. Staff can remove any duplicate entries.
