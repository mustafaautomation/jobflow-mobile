# Jobflow mobile

## Build

```bash
npm ci
npx expo export --platform web
```

Static SPA output is `dist/` (`web.output` is `single`). Serve it with a rewrite to `index.html`.

EAS profiles in `eas.json`: `development`, `preview`, `production`. Bundle id `com.quvantic.jobflow`. Do not run a paid EAS build from CI.

## Env vars

All optional. Empty means the seeded demo.

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` (anon or publishable only; service-role is refused)
- `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`

## Live URL

https://jobflow-app.quvantic.com

Local preview: `npx serve dist -s -l 44517`

## Tests

```bash
npm run lint
npm run typecheck
npm test
npx expo export --platform web
npm run test:e2e
```

Maestro flows live in `.maestro/` and need a simulator. CI (`.github/workflows/ci.yml`) runs lint, typecheck, Jest, web export, and Playwright on `ubuntu-latest` with no secrets.
