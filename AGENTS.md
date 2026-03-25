# Repository Guidelines

## Project Structure & Module Organization
This is an Expo Router + React Native app backed by Supabase auth and a Postgres workout data model.

- `app/_layout.tsx` is the root router layout and wraps the app with `AuthProvider`.
- `app/(auth)/` contains public auth routes: `login.tsx`, `register.tsx`, and `check-email.tsx`. Its layout redirects authenticated users away from auth screens.
- `app/(app)/` contains protected app routes: `index.tsx` for the dashboard, `create-routine.tsx` for routine setup, and `start-session.tsx` for logging a workout session. Its layout blocks unauthenticated access.
- `supabase/auth-context.tsx` owns session loading state and auth context access via `useAuth()`.
- `supabase/supabase.ts` configures the Supabase client, AsyncStorage-backed session persistence on native, and token auto-refresh.
- `supabase/config.toml` holds local Supabase CLI config. `supabase/snippets/` contains ad hoc SQL and policy notes, not runtime app code.
- `assets/` stores Expo icons and splash assets.

There is no active `App.tsx` entrypoint in this app. `package.json` points `main` to `expo-router/entry`, so route files under `app/` are the source of truth.

## Build, Test, and Development Commands
- `npm install` installs project dependencies.
- `npm start` starts the Expo development server.
- `npm run android` opens the app in an Android target through Expo.
- `npm run ios` opens the app in an iOS simulator.
- `npm run web` runs the app in a browser.
- `npx tsc --noEmit` performs the current type check. Run this before opening a PR.
- `supabase start` starts the local Supabase stack when working against the checked-in `supabase/config.toml`.

## Coding Style & Naming Conventions
Use TypeScript with `strict` mode enabled and match the existing file style closely.

- Use 2-space indentation and semicolon-free files.
- Keep route screens as default-exported PascalCase React components in their route files.
- Use camelCase for functions, helpers, and local state.
- Keep auth/session plumbing under `supabase/` and route UI under `app/`.
- Prefer small local helper functions for form sanitization and payload building, following the current screen patterns.
- Preserve the current user-facing language: screen copy is written in Spanish.

There is no ESLint or Prettier config checked in yet, so consistency with surrounding code matters.

## Data Model & Supabase Notes
The current app flow depends on these backend pieces:

- Supabase Auth for sign up, sign in, persisted sessions, and auth state changes.
- Tables such as `exercises`, `routines`, `routine_day_exercises`, and `workout_sessions`.
- The `finalize_workout_session` RPC used by `app/(app)/start-session.tsx`.

If you change database behavior, keep row-level security and user ownership checks aligned with the existing auth model.

## Testing Guidelines
There is no automated test suite configured yet. For now, contributors should:

- run `npx tsc --noEmit`
- verify the auth flow manually in Expo: register, login, redirect behavior, and check-email screen
- verify the protected app flow manually in Expo: dashboard loading, routine creation/editing, and workout session finalization
- document manual test coverage in the PR

When adding tests later, colocate them with the feature or place them under a dedicated `__tests__/` directory using `*.test.ts(x)`.

## Commit & Pull Request Guidelines
Git history is still minimal, so prefer short imperative commit subjects such as `Add workout session editor` or `Update routine builder validation`.

PRs should include:

- a clear summary of the behavior change
- linked issue or task, if any
- manual test notes
- screenshots or screen recordings for UI changes
- database migration or policy notes when Supabase schema behavior changes

## Security & Configuration Tips
Keep secrets in local environment files only. `supabase/supabase.ts` expects `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY`; do not hardcode credentials in source.

When changing auth or data access code, make sure anonymous users cannot reach protected routes and authenticated users cannot access another user's data.
