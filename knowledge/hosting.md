# Hosted (published) Astrato Apps

What changes once an app is published to Astrato hosting: access, layer revisions, the front-door
firewall, sessions and speed. Publishing itself is in [cli-and-publishing.md](cli-and-publishing.md).

---

## Signed-in users get `not_found`: "The publication or its data is no longer available."

- **Symptom:** colleagues sign in and land on that JSON error at the OAuth callback; the owner sees
  the app fine.
- **Cause:** a publication with audience `authenticated` still needs an explicit `view` grant.
  Publishing through the CLI grants only the creator (view, manage, delete, publish, manage_access).
  The service answers 404 rather than 403 when access is denied, so it reads as "missing". The
  regional cell host in the callback URL is normal.
- **Fix:** grant `view` to the tenant (or to people) in the UI (Library → ⋮ → Manage access), or
  through the publication access API with a PAT (`PUT …/publications/<id>/access`
  `{ subjectKind: 'tenant', permission: 'view' }`). Before sharing a link, open it as a non-owner.
- **Verified on:** 2026-11.

## A public link says "You do not have access to this publication or its data"

- **Cause:** setting the audience to public is not enough; the layer's data must be opened too.
- **Fix:** update the publication with audience `public` **and** `grantPublicDataAccess: true`
  (or "Grant access and make public" in the UI). This opens the layer, and possibly its connection,
  to anyone with the link: check what else uses that connection first. Verify signed out in a fresh
  profile.
- **Verified on:** 2026-10/11.

## The hosted app stops loading data after a layer publish

- **Symptom:** "Could not start: This app needs to be republished before it can load its data",
  "publication model is unavailable", or "could not authorize or complete this request".
- **Cause:** a publication is pinned to a layer revision.
- **Fix:** after every layer publish, republish every app on that layer, then live-smoke it. If the
  app still says the model is unavailable, publish the layer again at the same revision, then
  republish the app.
- **Verified on:** 2026-10/11.

## Hosted queries fail with a CORS error or 403

- **Symptom:** in the hosted app only, some objects error (`reduce of undefined`); the browser
  reports CORS or "Unable to reach the publication or its data exit node". Local `astrato dev` and
  MCP queries work.
- **Cause:** chart queries send each measure's formula string to the engine. The front-door
  firewall answers 403 (HTML, no CORS headers) when the formula contains the sequence `) / (`, for
  example `({m1} * {m2}) / ({m3} * {m4}) - 1`.
- **Fix:** rewrite the measure without `) / (`: `a * d / b / c - 1`. `(a / b) - (c / d)`,
  `(a + b) / c` and `a / b - 1` pass. To debug, record the failing request and replay variants.
- **Verified on:** 2026-10.

## Every new object fails about 8 minutes after load

- **Symptom:** `/_astrato/v2/mint` returns 401 "Open the publication to sign in"; new objects and
  lazy chunk fetches fail.
- **Cause:** the hosted session expires; a top-level reload signs back in.
- **Fix:** tap `fetch` and, on the first 401 from `/_astrato/`, reload once, restoring the page and
  selections (with a loop guard that shows "Sign in again"). Auto-reload once on the hosted "This
  app was updated" error too. A tab open across a publish gets 409 "The publication changed" once
  on reload.
- **Verified on:** hosted runtime v2, 2026-11.

## A 404 on `/data/semantic-layers/…` on first load

- **Cause:** benign: the runtime's prepare step looks a new model hash up before registering it.
  Objects still render and the next load is clean.
- **Fix:** allow-list it in smoke tests rather than failing the release.
- **Verified on:** 2026-11.

## The hosted app is much slower than local

- **Symptom:** a 20 s splash with the network idle; local timings looked fine.
- **Cause:** compiling and theming every object in the browser (seen on a 50-field layer too, so it
  is not only large layers); each vendored file is a separate request; the first load after any
  publish is cold.
- **Fix:** ship prebuilt themed vSpecs keyed by a hash of each tile and of the layer fields (one app
  went from a 22.9 s shell to 3.3 s); bundle or `modulepreload` the vendor chunks; preload lazy
  chunks after first paint, with retries. Always measure on the hosted URL.
- **Verified on:** visualizations 0.5.2, 2026-11.
- **See also:** [performance.md](performance.md#the-hosted-app-sits-on-the-splash-screen).

## Map tiles, favicons and other static gotchas

- A public OpenStreetMap tile server blocked requests from a hosted app; use a provider with a key
  or terms that allow it.
- The host cached `/favicon.svg` across publishes: rename the file instead of overwriting it.
- Hosted and public viewers cannot write back: see [writeback.md](writeback.md#writes-work-locally-but-not-on-the-hosted-app).
- **Verified on:** 2026-10/11.
