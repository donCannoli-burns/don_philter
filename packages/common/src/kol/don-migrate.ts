import {bufferToFile, fileToBuffer, getProperty, myName, setProperty} from 'kolmafia';

/** One-time, copy-only migration. Backups and upstream originals are never deleted or overwritten. */
export function migrateLegacyData(dataName: string, stockName: string): number {
  const name = myName();
  const plans = [
    {target: `don_data_${dataName}.txt`, backup: `don_archive_data_${dataName}.txt`,
      sources: [`OCDdata_${dataName}.txt`, `OCD_${name}_Data.txt`, `OCD_${name}.txt`]},
    {target: `don_stock_${stockName}.txt`, backup: `don_archive_stock_${stockName}.txt`,
      sources: [`OCDstock_${stockName}.txt`]},
  ];
  let copies = 0;
  for (const plan of plans) {
    if (fileToBuffer(plan.target).trim()) continue;
    for (const oldFile of plan.sources) {
      const oldData = fileToBuffer(oldFile);
      if (!oldData.trim()) continue;
      if (!fileToBuffer(plan.backup).trim() && !bufferToFile(oldData, plan.backup))
        throw new Error(`Cannot archive legacy data into ${plan.backup}`);
      if (!bufferToFile(oldData, plan.target))
        throw new Error(`Cannot migrate legacy data into ${plan.target}`);
      copies++;
      break;
    }
  }
  if (!getProperty('don_mallManagerHighlight')) setProperty('don_mallManagerHighlight', '2000000');
  if (!getProperty('don_philterVerbose')) setProperty('don_philterVerbose', 'false');
  return copies;
}
