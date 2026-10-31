/**
 * Read-only Philter ruleset verification.
 *
 * Calls the SAME cleanup and stocking parsers as the regular Philter runner.
 * This module must never import ./philter, ./planner, any cleanup executor,
 * mutable config defaults, update checks or the inventory refresh.
 */
import {
  loadCleanupRulesetFile,
  loadStockingRulesetFile,
} from '@philter/common/kol';
import {fileToArray, print, toInt} from 'kolmafia';
import {getvar} from 'zlib.ash';

type Candidate = {filename: string; legacy: boolean};
type FileRows = {filename: string; entries: string[]; count: number};
export interface VerificationResult {
  ok: boolean;
  cleanupFile: string | null;
  cleanupCount: number;
  stockingFile: string | null;
  stockingCount: number;
  stockEnabled: boolean;
  reason: string | null;
}

/**
 * Do not interpret a configured ZLib suffix as a relative path or URL.
 * A valid profile name may contain spaces, but not separators or control chars.
 */
function validSuffix(value: string): boolean {
  return (
    value.length >= 1 &&
    value.length <= 64 &&
    value.trim() === value &&
    /^[a-zA-Z0-9 _-]+$/.test(value)
  );
}

function fileRows(filename: string): FileRows {
  const raw = fileToArray(filename);
  const entries = Object.keys(raw).map(key => raw[key as unknown as number]);
  return {filename, entries, count: entries.length};
}

/**
 * Canonical Don files are always preferred. Legacy filenames are read-only
 * fallbacks for migrations. Never rewrite, rename or create a ruleset.
 */
function selectFile(
  candidates: Candidate[]
): {candidate: Candidate; rows: FileRows} | null {
  for (const candidate of candidates) {
    const rows = fileRows(candidate.filename);
    if (rows.count > 0) return {candidate, rows};
  }
  return null;
}

function checkFieldWidth(rows: FileRows, expectedFields: number): void {
  if (rows.count > 100000) {
    throw new Error('Ruleset exceeds 100000 records');
  }
  for (let i = 0; i < rows.entries.length; i++) {
    if (rows.entries[i].split('\t').length !== expectedFields) {
      throw new Error(
        `Unexpected field count in ${rows.filename} at parsed record ${i + 1}`
      );
    }
  }
}

function failureMessage(error: unknown): string {
  // Exception content may contain item or rule text. Avoid exposing raw rows.
  if (error instanceof Error) {
    const msg = error.message.replace(/[\r\n<>]/g, ' ').slice(0, 200);
    if (msg.includes('not a valid cleanup action')) {
      return 'Invalid cleanup action detected by Philter parser';
    }
    if (msg.includes('Invalid minimum price')) return 'Invalid MALL price';
    if (msg.includes('Invalid keep amount')) return 'Invalid keep quantity';
    if (msg.includes('Invalid stock-up amount')) return 'Invalid stock amount';
    if (
      msg.startsWith('Unexpected field count') ||
      msg.startsWith('Ruleset exceeds')
    )
      return msg;
  }
  return 'Philter parser rejected one or more records';
}

export function verifyRules(quiet = false): VerificationResult {
  const dataName = getvar('BaleOCD_DataFile');
  const stockName = getvar('BaleOCD_StockFile');
  const stockEnabled = getvar('BaleOCD_Stock') === '1';
  const result: VerificationResult = {
    ok: false,
    cleanupFile: null,
    cleanupCount: 0,
    stockingFile: null,
    stockingCount: 0,
    stockEnabled,
    reason: null,
  };

  if (!validSuffix(dataName) || !validSuffix(stockName)) {
    result.reason =
      'Invalid or missing ZLib filename suffix; check BaleOCD_DataFile and BaleOCD_StockFile';
    print('VERIFY-RULES FAILED: ' + result.reason, 'red');
    return result;
  }

  const cleanupCandidates: Candidate[] = [
    {filename: `don_data_${dataName}.txt`, legacy: false},
    {filename: `OCDdata_${dataName}.txt`, legacy: true},
    {filename: `OCD_${dataName}_Data.txt`, legacy: true},
  ];
  const stockingCandidates: Candidate[] = [
    {filename: `don_stock_${stockName}.txt`, legacy: false},
    {filename: `OCDstock_${stockName}.txt`, legacy: true},
  ];

  const cleanup = selectFile(cleanupCandidates);
  if (!cleanup) {
    result.reason = `No nonempty cleanup ruleset found; tried ${cleanupCandidates
      .map(c => c.filename)
      .join(', ')}`;
    print('VERIFY-RULES FAILED: ' + result.reason, 'red');
    return result;
  }

  result.cleanupFile = cleanup.candidate.filename;
  print(`Selected cleanup file: ${result.cleanupFile}`);
  if (cleanup.candidate.legacy) {
    print(
      'LEGACY FALLBACK: no usable don_data_ file found; no migration performed.',
      'orange'
    );
  }

  try {
    // Structural validation supplements, rather than replaces, Philter's parser.
    checkFieldWidth(cleanup.rows, 5);
    const parsed = loadCleanupRulesetFile(result.cleanupFile);
    if (!parsed || parsed.size !== cleanup.rows.count) {
      throw new Error('Parsed cleanup record count does not match source');
    }
    for (const item of parsed.keys()) {
      if (toInt(item) <= 0) {
        throw new Error('Unrecognized item identifier');
      }
    }
    result.cleanupCount = parsed.size;
    if (!quiet) {
      const counts: {[action: string]: number} = {};
      for (const rule of parsed.values()) {
        counts[rule.action] = (counts[rule.action] || 0) + 1;
      }
      for (const action of Object.keys(counts).sort()) {
        print(`  ${action}: ${counts[action]}`);
      }
    }

    const stocking = selectFile(stockingCandidates);
    if (stocking) {
      result.stockingFile = stocking.candidate.filename;
      print(`Selected stocking file: ${result.stockingFile}`);
      if (stocking.candidate.legacy) {
        print(
          'LEGACY STOCK FALLBACK: read only; no migration performed.',
          'orange'
        );
      }
      checkFieldWidth(stocking.rows, 4);
      const parsedStock = loadStockingRulesetFile(result.stockingFile);
      if (!parsedStock || parsedStock.size !== stocking.rows.count) {
        throw new Error('Parsed stocking record count does not match source');
      }
      for (const item of parsedStock.keys()) {
        if (toInt(item) <= 0)
          throw new Error('Unrecognized stock item identifier');
      }
      result.stockingCount = parsedStock.size;
    } else {
      print(
        `No nonempty stocking file found; tried ${stockingCandidates
          .map(c => c.filename)
          .join(', ')}`,
        stockEnabled ? 'red' : 'orange'
      );
      if (stockEnabled) {
        throw new Error('Stocking enabled but no stock ruleset available');
      }
    }
  } catch (error) {
    result.reason = failureMessage(error);
    print('VERIFY-RULES FAILED: ' + result.reason, 'red');
    return result;
  }

  result.ok = true;
  print(
    `VERIFY-RULES PASS: ${result.cleanupCount} cleanup records, ${
      result.stockingCount
    } stock records; automatic stocking ${
      stockEnabled ? 'ENABLED' : 'disabled'
    }.`,
    'green'
  );
  print(
    'Read-only verification. NO inventory refresh, cleanup, transfers or saved file changes.'
  );
  return result;
}
