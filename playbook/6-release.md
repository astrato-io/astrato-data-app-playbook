# 6. Release

The standard is that problems are found before the audience finds them. A hosted app can fail in
ways a local session and the CLI's own publish checks never exercise: rate-limited query bursts,
a lazily loaded chunk that fails to load, a blocked map tile server, a request the hosted
firewall refuses, a viewer with no access. So every release goes through the same gate.

The [kit](../kit/README.md) has a smoke test and release gate that implement this step.

## 1. The gate

```
build → smoke the build locally → publish → smoke the live copy
```

Never publish past a local failure. Automate it as one script (`release`), so the gate is not
skipped when time is short.

**The smoke test** opens the app in a real, visible browser with its own profile (sign in once
for hosted URLs) and fails on:

- a boot error or an error message on screen;
- any object that does not reach rendered, on any tab;
- any request with status ≥ 400, and any console error (allow-list known benign messages by
  exact text, never by category);
- broken map tiles or images;
- a landing time over your budget;
- an export that does not produce a file on disk. Prove the download completed after a real
  click; a blob being built is not enough.

It saves a screenshot per tab. To make this cheap, have the app expose its state on `window`
(the objects, which are mounted and rendered, failures and timings).

The CLI's publish verification can report data queries as not checked; only the live smoke
proves the hosted app works. See [knowledge/cli-and-publishing.md](../knowledge/cli-and-publishing.md).

## 2. Publishing the layer breaks live apps

A publication is pinned to a revision of its semantic layer. After you publish the layer,
apps published against the old revision can stop loading their data until they are themselves
republished.

- After every layer publish, republish **every** app on that layer, then live-smoke each.
- Re-run any question-sync or vSpec-cache step first: publishing one measure can change the
  result shape of others.
- Changes that matter to the app are not live until both the layer and the app are published.

## 3. Access is deliberate

A new publication is, by default, visible only to its owner. Other viewers sign in and then see a
"not found" or "no longer available" message rather than a permission error, which reads like a
broken app.

- Decide the audience before sharing a link: named users, a group, the whole tenant, or public.
- Grant it explicitly (`astrato_management_access_list` / `astrato_management_access_grant`, or
  the publication's sharing settings). A public app also needs its data access granted.
- Making an app public is a decision for its owner; ask before doing it.
- Then open the link **as a non-owner** (a fresh browser profile, signed out or as a test user)
  and run the smoke against it.

Viewers of a hosted or public app may not be able to write. A workflow must then fall back to
its labelled browser-only mode; check that it says so. See
[knowledge/writeback.md](../knowledge/writeback.md).

## 4. Hosted-only failures to check for

These pass locally and fail live; details in [knowledge/hosting.md](../knowledge/hosting.md).

- **The hosted firewall refusing a query.** Measure formulas are sent with each query; some
  character sequences in a formula (for example a closing and opening bracket around a division)
  can be refused by the hosted front door. The browser reports it as a CORS or network error.
  Rewrite the formula without the sequence; it does not happen in local development.
- **Bursts and 429s.** Many objects at once: the query scheduler's lanes and retries must be in
  the published build.
- **Many small files.** Each module is a separate request on the hosted runtime; bundle the
  build output if load time suffers.
- **Map tiles.** Some public tile servers block embedded apps; use a provider that allows them.

## 5. After release

- Record the publication version, the layer revision it is pinned to, and the audience.
- Re-run the live smoke after any layer publish, library upgrade or access change.
- Score the app with the [rubric](rubric.md) and list what to fix next.
