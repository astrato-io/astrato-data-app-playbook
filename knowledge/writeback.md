# Writeback

`app.writeback` from an Astrato App into governed views, and the Data Actions around it. The
workflow design is in [../patterns/writeback-workflow.md](../patterns/writeback-workflow.md).

Call shape that works:

```js
await app.writeback({
  view: 'Workflow Records',       // the view's name in the published layer
  operation: 'insert',            // or 'update' (with keys) or 'delete'
  fields: [{ name: 'Status', valueType: 'string' }, ...],
  values: [['Approved', ...]],
  keys: [...],                    // update/delete
});
```

On app-runtime 0.8 and 0.9 `AstratoAppWritebackRequest` has no `dataviewID`: the runtime adds
the layer id from its own context. Older builds (2026-10, version not recorded) needed
`dataviewID: layerId`, and a placeholder id made every write fail; examples that still pass it
are harmless, since the runtime overwrites it. Verified without it on 0.9.0
under `astrato dev`: insert, update and delete, with ISO dates (`Z`) as `valueType: 'date'` into
timestamp and date columns (2026-11).

---

## How do I create a writeback table?

- **Cause:** a workflow needs its own records and audit tables, and the layer has none.
- **Fix:** with the owner's OK, `astrato_data_import_csv` with `semanticLayerId` creates the table
  in that layer's own connection (it must allow writes) and adds it to the layer as a view over
  all its columns. A header-only CSV is refused: *"The file has a header but no data rows."*
  Import one clearly labelled placeholder row (an id such as `SEED-0000`), pin types with
  `columnTypes`, and have the app delete that row through `app.writeback` on first load. An
  existing table name is refused.
- Names change on the way in: `WORK_FLAGS` became the view `Work Flags`, warehouse columns
  are lower-cased (`"flag_id"`) and view fields title-cased (`Flag ID`). Write with the view's
  field names.
- The import also edits the layer's settings document (`engineProperties/csvSourcedTables`), which
  `preview_publish` lists as a change alongside the new view. It adds an entry for the new table
  and leaves existing items alone, so "only add to the layer" covers it; say so in the brief. Only
  a brief that forbids any settings change rules it out.
- **Verified on:** MCP tool contract 10.39, Snowflake, 2026-11.

## `app.writeback` fails: 400 `invalid_request` "Astrato rejected the runtime request."

- **Cause:** usually in the warehouse, not the request: tables built with CTAS from string literals
  get literal-sized columns (`VARCHAR(14)`, `VARCHAR(1)`), and any longer value is refused. The
  error names no column.
- **Fix:** `ALTER TABLE … ALTER COLUMN c SET DATA TYPE VARCHAR` for every text column of a
  writeback table, then run the layer's source-schema check (0 drift). To find the column, write
  one field at a time from the page console.
- **Verified on:** 2026-10.

## Other reasons a write is rejected

- Every field name must exist in the **published** view (the CLI checks this).
- Values must be scalars of the declared type; write dates as ISO strings with a trailing `Z`
  (`2026-10-12T20:04:00Z`).
- Some deployments refuse multi-row `values` on update: send one keyed row per request (~1.5 s
  each; show progress).
- `delete` must omit `fields` and `values`.
- Duplicate input names in one HTML form clobber each other in `FormData`, producing a rejected
  write.
- **Verified on:** 2026-10/11.

## An update throws "no rows changed" and the audit insert never happens

- **Cause:** an `update` that changes nothing (the value is already current) throws, and aborts a
  chained write such as the audit insert.
- **Fix:** send only fields whose value changed; treat `rowsAffected: 0` as a failure you handle,
  not a silent success.
- **Verified on:** 2026-11.

## The app shows the old value after a successful write

- **Cause:** a session query cache (or `getData` memo) serves the pre-write result.
- **Fix:** clear the query cache after every write and re-read; exclude writeback views and their
  measures from long-lived caches.
- **Verified on:** 2026-11.
- **See also:** [../patterns/query-scheduler.md](../patterns/query-scheduler.md).

## Writes work locally but not on the hosted app

- **Symptom:** "not enabled for this App" for hosted or public viewers.
- **Cause:** hosted and public publications could not write back in the versions tested.
- **Fix:** keep a labelled fallback (browser storage, marked "local mode"), and say so in the app.
  Test on the hosted URL before promising writes.
- **Verified on:** hosted runtime v2, 2026-10/11. The app-runtime 0.8.0 and 0.9.0 bundles refuse
  `writeback` and `executeProcedure` outside `astrato dev` before any request ("This write operation
  is not enabled for this App."; previews: "Write operations are not enabled for App previews.").

## The app cannot call a Data Action

- **Symptom:** `app.executeProcedure` fails for a layer's Data Action (the gateway refuses spaces in
  procedure names).
- **Cause:** builds before app-runtime 0.8 have no call for named Data Actions. 0.8 and 0.9 do:
  `runDataAction({ name, arguments? }, { signal }?): Promise<AstratoAppDataActionResult>`, where
  `arguments` is one named-argument object per invocation and the result is
  `{ dataAction, invocations, outcomes: [{ inputIndexes, status, effects, error? }] }`. Under
  `astrato dev` it needs the `procedure:execute` capability (else *"Data actions are not enabled
  for this App."*); previews refuse it; a published App sends it to the gateway, which decides.
  `effects: 'unknown'` means the write may have committed: check before retrying.
- **Fix:** on 0.8+ try `runDataAction` first and test it on the surface you ship. Where it is
  refused, or on older builds, keep the Data Actions in the layer and mirror each one in the app
  as `app.writeback` calls: the record change, then the audit insert. These are not
  transactional, so order them so a partial failure is visible. `app.writeback` works even when
  the layer's writeback mode is Data Actions.
- **Verified on:** the mirror, 2026-11 (runtime version not recorded); `runDataAction` read from
  the app-runtime 0.8.0 and 0.9.0 typings and bundle, not run.

## `AstratoAppRuntimeError: Astrato returned an invalid Astrato App bootstrap.`

- **Cause:** the gateway started granting `procedure:execute` and `data:writeback` capabilities,
  and older vendored app-runtime builds reject unknown capabilities.
- **Fix:** see [cli-and-publishing.md](cli-and-publishing.md#astratoappruntimeerror-astrato-returned-an-invalid-astrato-app-bootstrap).
- **Verified on:** 2026-10.

## Forms that drive writes do not submit in a background tab

- **Cause:** a `<dialog>`'s `close` event does not fire in a hidden tab.
- **Fix:** handle the form's `submit` event (`ev.submitter` tells which button); never use
  `prompt()` or `alert()` (an `alert` froze a tab).
- **Verified on:** 2026-11.
