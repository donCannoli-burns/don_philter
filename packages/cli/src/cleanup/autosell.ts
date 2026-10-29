import {logger} from '@philter/common/kol';
import {autosell, autosellPrice, getProperty} from 'kolmafia';
import {assert} from 'kolmafia-util';
import {rnum} from 'zlib.ash';
import {splitItemsSorted} from '../util';
import {CleanupActionFunction, safeBatchItems} from './base';

function printAutosell(items: ReadonlyMap<Item, number>, verbose: boolean): number {
  let expectedProfitTotal = 0;

  for (const chunk of splitItemsSorted(items, 11)) {
    const messages: string[] = [];
    let lineValue = 0;

    for (const [item, amount] of chunk) {
      lineValue += amount * autosellPrice(item);
      messages.push(`${amount} ${item}`);
    }

    if (verbose) logger.info(`autosell ${messages.join(', ')}`);
    expectedProfitTotal += lineValue;
  }

  logger.info(`Total autosale = ${rnum(expectedProfitTotal)}`);
  return expectedProfitTotal;
}

/**
 * Cleanup action that autosells items.
 */
export const cleanupAutosell: CleanupActionFunction = (plan, config) => {
  const items = plan.autosell;
  if (items.size === 0) return {shouldReplan: false, profit: 0};

  const profit = printAutosell(items, config.simulateOnly || getProperty('don_philterVerbose') === 'true');
  if (!config.simulateOnly) {
    safeBatchItems(
      items,
      chunk => {
        for (const [item, amount] of chunk) {
          assert.ok(
            autosell(amount, item),
            `Failed to batch: autosell(${amount}, Item.get(\`${item}\`))`
          );
        }
      },
      chunk => assert.fail(`Failed to autosell ${chunk.size} item(s)`)
    );
  }

  return {shouldReplan: false, profit};
};
