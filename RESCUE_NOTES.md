# Rescued from Cursor

Source: Jobflow Mobile — Expo app | Cursor https://cursor.com/agents/bc-37d1e76a-8032-54d5-904b-2cc48d3a06c7
Scope: Last Agent Turn
Captured: 2026-11-25T11:46:25.288Z
Files written: 88

Not in this copy: files Cursor's template created and the agent never changed (e.g. tsconfig, shadcn ui components, lockfiles, public assets) when scope is 'Last Agent Turn'; binaries.


## Repair pass (Claude, 2026-11-25)

Recreated:
- tsconfig.json: Expo SDK 58 default-template version (expo/tsconfig.base, strict, @/* -> ./src/*).
- assets/images/{icon,favicon,splash-icon,android-icon-foreground,android-icon-background,android-icon-monochrome}.png: copied from expo-template-default@58.0.35 (the template this app was scaffolded from). These are the stock Expo placeholder icons, not Jobflow branding.
- package-lock.json: regenerated with npm.
- docs/screenshots/*.png: re-captured from the rebuilt web export with the repo's own scripts/capture-screenshots.mjs (real captures of the demo, not mockups).

Fixed:
- e2e/technician.spec.ts: getByText('No cool — outdoor capacitor') matched both the hidden Today card (still mounted under the stack on web) and the job heading; now asserts the heading role.
- scripts/capture-screenshots.mjs: used URL.pathname for the output path, which breaks when the repo path contains spaces; now uses fileURLToPath.

Checks run locally on 2026-11-25 (Node 22.23.4, the CI version; npm install was done with Node 25):
- npm install: OK, package-lock.json regenerated (all from registry.npmjs.org)
- npm run lint: pass
- npm run typecheck (tsc --noEmit): pass
- jest: 7 suites, 25 tests pass (matches the Cursor run)
- npx expo export --platform web: pass (dist/)
- Playwright web e2e (chromium, CI=true): 4 passed (matches the Cursor run)

Note: under heavy machine load the first cold Jest run timed out on the first component test of a few suites (default 5s timeout while modules transform); a warm re-run passes. Not a code problem, but CI on a cold cache could be slow on that first test.

Still missing / needs a person: real app icons (stock Expo placeholders in place); Maestro flows not run (need a simulator); Apple/Google/Expo accounts, DNS, Supabase keys as listed in README. No EAS build was run.

## App icons (Claude, 2026-11-25)

- Replaced the stock Expo placeholders in `assets/images/` with real Jobflow icons, rendered by the new `scripts/generate-icon.mjs` (plain Node, no dependencies, same approach as stamply-mobile) from the web app's mark (`jobflow/src/app/icon.svg` = `components/logo.tsx` <Mark>: arch + crossbar, white on #C4622D). Outputs: icon (1024, full-bleed), splash-icon (glyph only), favicon (48, rounded tile), Android adaptive background/foreground/monochrome (glyph at 72% for the safe zone).
- `app.config.ts`: adaptive-icon and splash background changed from the in-app teal #0E6B62 to the logo colour #C4622D (splash imageWidth 76 -> 96). Notification tint left as is.
- Checks: lint pass, typecheck pass, jest 7 suites / 25 tests pass, `expo config` resolves.
