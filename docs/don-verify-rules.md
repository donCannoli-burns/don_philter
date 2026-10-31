# Don Philter `verify-rules` — parser-only inspection

This fork exposes **the actual Philter cleanup and stocking ruleset parsers**, without entering inventory cleanup, inventory refresh, purchases, sales, transfers, automatic stocking, ZLib initialization, update checks, or file writes.

## Xpra-safe entrypoint (recommended for existing custom fork)

The separately compiled `don_philter_report.js` can be installed without replacing an existing customized `philter.js` or `don_philter.js` wrapper:

```text
call don_philter_report.js verify-rules
call don_philter_report.js verify-rules --quiet
```

Once a matching, verified main CLI bundle is explicitly installed, `don_philter verify-rules` also works if the user's wrapper forwards its arguments to `philter.js`. **Do not replace an installed customized Philter bundle automatically**: the current repository source still contains upstream legacy naming in its normal cleanup runner, whereas some deployed Don forks already implement their own migration routine. First reconcile the actual installed implementation with this repository before deploying the normal CLI bundle.

## Data-file selection

The verifier reads **ZLib**, not ordinary KoLmafia `get` preferences:

- `BaleOCD_DataFile` — suffix for cleanup rules
- `BaleOCD_StockFile` — suffix for stocking rules
- `BaleOCD_Stock` — whether stock rules are required

These ZLib preference keys retain their upstream names solely for compatibility; the canonical Don output filename does **not** need to contain `OCD`.

For the configured suffix `doncannoli1`, file lookup is in this exact order:

| Cleanup (first nonempty) | Stock (first nonempty) |
| --- | --- |
| `don_data_doncannoli1.txt` | `don_stock_doncannoli1.txt` |
| `OCDdata_doncannoli1.txt` (legacy fallback) | `OCDstock_doncannoli1.txt` (legacy fallback) |
| `OCD_doncannoli1_Data.txt` (legacy fallback) | |

The verifier prints the **selected filename** and explicitly calls out legacy fallback. It never migrates, copies, renames, archives or modifies any file. If the canonical file contains records but is malformed, verification fails without switching to a legacy file. An empty/missing cleanup file blocks verification. With `BaleOCD_Stock=0`, a missing/empty stocking file is reported but is not a blocker. With `BaleOCD_Stock=1`, a missing/empty stocking file blocks verification.

A filename suffix must be a safe local token without path separators, URLs or control characters. Both configured suffixes must be valid.

## Validation claims

- Uses `loadCleanupRulesetFile` and `loadStockingRulesetFile` from `@philter/common/kol`, the same parser functions called by the existing cleanup runner.
- Independently checks exactly **five** tab-separated cleanup fields and **four** stock fields per parsed record.
- Compares source record counts with the parser's distinct-item counts; duplicates and unknown item IDs fail closed.
- Prints per-action counts unless `--quiet` is supplied.
- Reports a clear PASS/FAILED verdict, selected filenames, and automatic stocking status.

**PASS means file parsing and structural checks passed; it does not authorize or prove a cleanup plan is safe.** No server-side state, mall pricing, inventory reconciliation or cleanup action is attempted.

For your Xpra deployment, the data root is the Docker bind mount at `/home/kolmafia/.kolmafia`. The KoLmafia loader resolves files relative to its data folder. The verifier does not try to discover or change host paths.

## Build and controlled install

In the local source repository:

```bash
cd ~/repos/donCannoli-burns/don_philter
git pull --ff-only
yarn install --frozen-lockfile
yarn run build:cli
node tests/verify-rules.test.cjs
```

Check that `release/scripts/don_philter_report.js` exists. On the **Linux host**, copy **only that one new bundle** into the verified Xpra profile's scripts directory, making a backup if a destination already exists. Do not install/replace `philter.js`, `don_philter.js`, character data files, or existing custom migration code as part of this verifier rollout. Your existing `don_data_doncannoli1.txt` ruleset should not be touched.

Then in Xpra gCLI:

```text
call don_philter_report.js verify-rules --quiet
call don_philter_report.js verify-rules
```

Do **not** use `don_philter run` or `BaleOCD_Sim=true` as a parser test: the normal entrypoint can still perform inventory-related operations outside the cleanup plan.

## Engineering limits

- A missing file and an intentionally empty file are indistinguishable through the current `fileToArray` API; both are reported as no nonempty ruleset.
- Per-record parser exceptions are summarized without printing raw user rules.
- If the installed custom bundle's ruleset parser differs from `@philter/common/kol` in source, the verifier only proves compatibility with the parser shipped in the newly built reporter. Reconcile both implementations before relying on it as proof of custom runner compatibility.
- The verifier does not set KoLFix `donReport_` preferences or record a Don Report JSON receipt. It performs a single foreground read-only query.
