# don_philter upstream archive and recovery

The original `main` tree was preserved unchanged at `archive/upstream_philter-20261028` before starting this feature. Old source is also retained in Git history.

## Local rulesets
The migration is **copy-only**, and runs when `don_philter`, `philter`, or the modern relay manager is launched:
- From `OCDdata_<BaleOCD_DataFile>.txt`, or older `OCD_<player>_Data.txt` / `OCD_<player>.txt`, to `don_data_<BaleOCD_DataFile>.txt`.
- From `OCDstock_<BaleOCD_StockFile>.txt` to `don_stock_<BaleOCD_StockFile>.txt`.
- A second preserved copy is written to `don_archive_data_<name>.txt` / `don_archive_stock_<name>.txt`.
- No local old data file is deleted. If an existing don_ target already has content it is not overwritten.

**Do not run the old upstream manager and new fork concurrently to edit separate copies of the rules.** Check the copies and run a simulation first.

## Git/install payload
The inactive legacy script `ocd-cleanup.ash` is renamed `don_legacy_cleanup.ash`, and the classic relay imports its new name. Legacy bundled default data files move to `don_cleanup_default.txt` and `don_cleanup_stock.txt`. Unused upstream `ocd-cleanup-manager` directory markers are omitted; all remain available in the archived branch. Internal `BaleOCD_*` preference keys, `_ocd_*` ASH helper functions, and upstream documentation retain historical spellings for compatibility, not as installed filenames.

## Smoke checks
1. `verify don_philter.js`; `don_philter help` should print help without game changes.
2. Open **Philter Manager** from the relay dropdown. Confirm your old categories are loaded and a `don_data_<player>.txt` file exists.
3. `set don_mallManagerHighlight=2000000`; reload relay. A price **greater than** the configured amount gets the high-value treatment.
4. `zlib BaleOCD_Sim = true` followed by `don_philter` exercises simulated cleanup. Answer No to test the hard stop, then Yes to test the simulation.
5. Install Mall Manager separately, then `don_philter mall-manager sim reprice` / `don_philter mall-manager sim clean`.
6. Only after checking the test results, set `zlib BaleOCD_Sim = false` for a live cleanup.

These are manual KoLmafia integration tests, not claims of a completed live test.
