import {
  checkProjectUpdates,
  loadCleanupConfig,
  logger,
  migrateLegacyData,
  setDefaultConfig,
} from '@philter/common/kol';
import {canInteract, cliExecute, userConfirm} from 'kolmafia';
import {getvar, rnum} from 'zlib.ash';
import {philter} from './philter';

/**
 * Check if your character is in Ronin/Hardcore. If so, ask for confirmation to
 * proceed.
 * @return Whether Philter should be executed now
 */
function canInteractCheck(): boolean {
  if (canInteract()) return true;

  const action = getvar('BaleOCD_RunIfRoninOrHC');
  if (action === 'never') return false;
  if (action === 'always') return true;

  logger.info('Ronin/Hardcore detected. Asking confirmation to proceed...');
  return userConfirm(
    'You are in Ronin/Hardcore. Do you want to run Philter anyway?'
  );
}

// TODO: Parse CLI arguments, merge them with ZLib configs, and make the rest of
// the app use the merged config instead of accessing settings directly.
export function main(command = ''): void {
  setDefaultConfig();
  const copies = migrateLegacyData(getvar('BaleOCD_DataFile'), getvar('BaleOCD_StockFile'));
  if (copies) logger.success(`Recovered ${copies} upstream file(s), with archived copies.`);
  const cmd = String(command || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (cmd === 'help') {
    logger.info('don_philter [run | help | mall-manager reprice | mall-manager clean | mall-manager sim reprice | mall-manager sim clean]');
    return;
  }
  if (/^(?:mall-manager )?(?:sim )?(?:reprice|clean)(?: sim)?$/.test(cmd)) {
    const op = cmd.replace(/^mall-manager /, '');
    logger.info(`don_philter | delegate mall-manager ${op}`);
    if (!cliExecute(`mall-manager ${op}`)) logger.error('Mall Manager command failed; install donCannoli-burns/mall-manager.');
    return;
  }
  if (cmd && cmd !== 'run') { logger.error(`Unknown argument: ${command}`); return; }
  if (!userConfirm('don_philter cleanup: Yes=proceed immediately; No=hard stop; defaults Yes after 30 seconds.', 30000, true)) {
    logger.error('don_philter | HARD STOP. No cleanup performed.');
    return;
  }
  if (!canInteractCheck()) { logger.error('Ronin/Hardcore gate blocked cleanup.'); return; }
  logger.info('don_philter | cleanup started');
  const meatGain = philter(Object.freeze(loadCleanupConfig()));
  if (meatGain < 0) logger.error('don_philter | cleanup failed');
  else if (meatGain === 0) logger.warn('don_philter | complete | no estimated gain');
  else logger.success(`don_philter | complete | expected gain: ${rnum(meatGain)} Meat`);
}
