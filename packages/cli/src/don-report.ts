/**
 * Separate Philter observation entrypoint.
 * It must NEVER import ./philter, ./planner or any cleanup action modules.
 * No purchases, movement, cleanup, user prompts, or preference writes.
 */
import {
  getInventory,
  myAscensions,
  myId,
  print,
  todayToString,
  toInt,
} from 'kolmafia';
import {toItemMap} from '@philter/common/kol';
import {verifyRules} from './verify-rules';

export interface InventoryProbe {
  itemId: number;
  quantity: number;
}
export function collectInventory(): InventoryProbe[] {
  return [...toItemMap(getInventory()).entries()]
    .filter(([item, amount]) => toInt(item) > 0 && amount > 0)
    .map(([item, amount]) => ({itemId: toInt(item), quantity: amount}))
    .sort((a, b) => a.itemId - b.itemId);
}
export function main(command = 'help'): void {
  const parts = command.trim().split(/\s+/).filter(Boolean);
  const action = parts.shift() || 'help';
  const allowed = new Set(['--quiet', '--print', '--diff', '--json']);
  if (
    !['help', 'status', 'item_new', 'inventory_snapshot', 'verify-rules'].includes(action) ||
    parts.some(x => !allowed.has(x))
  ) {
    print('Don Philter report: unknown command, no cleanup executed.', 'red');
    return;
  }
  if (action === 'help') {
    print('don_philter_report.js inventory_snapshot [--quiet|--print|--json]');
    print('don_philter_report.js item_new [--diff] (requires prior receipt)');
    print('don_philter_report.js verify-rules [--quiet] (read-only parser)');
    return;
  }
  if (action === 'verify-rules') {
    if (parts.some(flag => flag !== '--quiet')) {
      print('Usage: don_philter_report.js verify-rules [--quiet]', 'red');
      return;
    }
    verifyRules(parts.includes('--quiet'));
    return;
  }
  if (action === 'status') {
    print('Philter observation adapter: read-only, no executor or relay hook.');
    return;
  }
  const scope = `${myId()}:${todayToString()}:${myAscensions()}`;
  if (action === 'item_new' || parts.includes('--diff')) {
    print(
      'KNOWN_UNKNOWN: a verified prior inventory receipt is required for new-item detection.',
      'orange'
    );
    if (action === 'item_new') return;
  }
  const inventory = collectInventory();
  if (parts.includes('--json')) {
    print(
      JSON.stringify({
        schema: 'don-inventory-probe-v1',
        source: 'philter',
        scope,
        inventory,
      })
    );
  } else if (!parts.includes('--quiet') || parts.includes('--print')) {
    for (const item of inventory)
      print(
        `donstate:v1:${scope}:inventory:item/${item.itemId}:quantity = ${item.quantity}`
      );
  }
  print(
    `Philter read-only: ${inventory.length} distinct inventory items; no cleanup performed.`
  );
}
