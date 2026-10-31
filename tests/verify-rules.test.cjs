'use strict';
/**
 * Test the BUILT isolated Don Philter bundle with a synthetic KoLmafia runtime.
 * No KoL login, file writes, items, preferences, network, or cleanup actions.
 */
const assert = require('assert').strict;
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const repo = path.resolve(__dirname, '..');
const bundle = fs.readFileSync(
  path.join(repo, 'release/scripts/don_philter_report.js'),
  'utf8'
);
const verifierSource = fs.readFileSync(
  path.join(repo, 'packages/cli/src/verify-rules.ts'),
  'utf8'
);
const entrySource = fs.readFileSync(
  path.join(repo, 'packages/cli/src/index.ts'),
  'utf8'
);

function run(args, files = {}, preferences = {}) {
  const output = [];
  const accesses = [];
  const mutating = [];
  const items = new Map();
  const stock = Object.assign(
    {
      BaleOCD_DataFile: 'doncannoli1',
      BaleOCD_StockFile: 'doncannoli1',
      BaleOCD_Stock: '0',
    },
    preferences
  );
  function item(value) {
    const m = /^\[(\d+)\]/.exec(String(value));
    const id = m ? Number(m[1]) : 0;
    if (!items.has(id)) items.set(id, {id, name: String(value)});
    return items.get(id);
  }
  function deny(name) {
    return (...a) => {
      mutating.push(name);
      throw new Error('FORBIDDEN_RUNTIME_ACTION: ' + name + ' ' + a.length);
    };
  }
  const kolmafia = {
    fileToArray: filename => {
      accesses.push(filename);
      return files[filename] || [];
    },
    toItem: item,
    toInt: value => typeof value === 'object' ? value.id : Number(value),
    toBoolean: value => value === 'true',
    print: value => output.push(String(value)),
    getInventory: deny('getInventory'),
    cliExecute: deny('cliExecute'),
    setProperty: deny('setProperty'),
    bufferToFile: deny('bufferToFile'),
    visitUrl: deny('visitUrl'),
    emptyCloset: deny('emptyCloset'),
    myName: deny('myName'),
    myId: deny('myId'),
  };
  const mod = {exports: {}};
  const context = {
    module: mod,
    exports: mod.exports,
    require: name => {
      if (name === 'kolmafia') return kolmafia;
      if (name === 'zlib.ash') return {getvar: key => stock[key] || ''};
      if (name === 'philter.util.ash') return {};
      throw new Error('Unexpected module import: ' + name);
    },
    console,
    Item: {get: item},
  };
  vm.runInNewContext(bundle, context, {timeout: 5000});
  assert.equal(typeof mod.exports.main, 'function');
  mod.exports.main(args);
  assert.deepEqual(mutating, [], 'verification invoked a mutating/refresh action');
  return {output: output.join('\n'), accesses};
}

const good = [
  '[13]Example Item\tAUTO\t0\t\t',
  '[14]Another Item\tMALL\t0\t100\t',
  '[15]Third Item\tKEEP\t1\t\t',
];
let passed = 0;
function check(label, fn) {
  fn();
  passed++;
  console.log('PASS:', label);
}

check('no mutating primitives referenced by verification module', () => {
  assert.doesNotMatch(
    verifierSource,
    /\b(?:cliExecute|inventoryRefresh|visitUrl|bufferToFile|setProperty|emptyCloset|buy|mallPrice|stock|philter\()\s*\(/i
  );
});
check('verify-rules dispatch precedes normal Philter work', () => {
  const cmd = entrySource.indexOf("if (args[0] === 'verify-rules')");
  assert.ok(cmd >= 0);
  assert.ok(cmd < entrySource.indexOf('setDefaultConfig();'));
  assert.ok(cmd < entrySource.indexOf('checkProjectUpdates();'));
  assert.ok(cmd < entrySource.indexOf('wait(10);'));
});
check('canonical filename uses the production parser and prints counts', () => {
  const r = run('verify-rules', {'don_data_doncannoli1.txt': good});
  assert.match(r.output, /Selected cleanup file: don_data_doncannoli1\.txt/);
  assert.match(r.output, /AUTO: 1/);
  assert.match(r.output, /MALL: 1/);
  assert.match(r.output, /KEEP: 1/);
  assert.match(r.output, /VERIFY-RULES PASS: 3 cleanup records, 0 stock records/);
  assert.ok(r.accesses.includes('don_data_doncannoli1.txt'));
});
check('quiet suppresses action details but still shows verdict', () => {
  const r = run('verify-rules --quiet', {'don_data_doncannoli1.txt': good});
  assert.doesNotMatch(r.output, /AUTO: 1/);
  assert.match(r.output, /VERIFY-RULES PASS:/);
});
check('legacy file accepted as explicitly marked read-only fallback', () => {
  const r = run('verify-rules', {'OCDdata_doncannoli1.txt': good});
  assert.match(r.output, /LEGACY FALLBACK/);
  assert.match(r.output, /Selected cleanup file: OCDdata_doncannoli1\.txt/);
});
check('invalid row blocks verification without switching to legacy', () => {
  const r = run('verify-rules', {
    'don_data_doncannoli1.txt': ['[13]Item\tMALL\t0\t'],
    'OCDdata_doncannoli1.txt': good,
  });
  assert.match(r.output, /VERIFY-RULES FAILED/);
  assert.doesNotMatch(r.output, /VERIFY-RULES PASS/);
  assert.ok(!r.accesses.includes('OCDdata_doncannoli1.txt'));
});
check('invalid action rejects via real cleanup parser', () => {
  const r = run('verify-rules', {
    'don_data_doncannoli1.txt': ['[13]Item\tBAD\t0\t\t'],
  });
  assert.match(r.output, /Invalid cleanup action detected by Philter parser/);
});
check('duplicate item ID fails closed', () => {
  const r = run('verify-rules', {
    'don_data_doncannoli1.txt': [
      '[13]Item\tAUTO\t0\t\t',
      '[13]Item\tKEEP\t0\t\t',
    ],
  });
  assert.match(r.output, /VERIFY-RULES FAILED/);
});
check('enabled stock with missing file blocks verification', () => {
  const r = run(
    'verify-rules',
    {'don_data_doncannoli1.txt': good},
    {BaleOCD_Stock: '1'}
  );
  assert.match(r.output, /stocking enabled but no stock ruleset available|Philter parser rejected/i);
  assert.doesNotMatch(r.output, /VERIFY-RULES PASS/);
});
check('malicious configured filename suffix is refused before file I/O', () => {
  const r = run('verify-rules', {'don_data_doncannoli1.txt': good}, {
    BaleOCD_DataFile: '../../session',
  });
  assert.match(r.output, /VERIFY-RULES FAILED/);
  assert.deepEqual(r.accesses, []);
});
check('unknown flags never access inventory or any ruleset', () => {
  const r = run('verify-rules --execute', {'don_data_doncannoli1.txt': good});
  assert.match(r.output, /unknown command|Usage: don_philter_report\\.js verify-rules/);
  assert.deepEqual(r.accesses, []);
});
console.log('Don Philter verify-rules tests passed:', passed);
