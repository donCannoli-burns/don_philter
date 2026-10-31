/* eslint-disable node/no-unpublished-import */
import buble from '@rollup/plugin-buble';
import {nodeResolve} from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import createBubleConfig from 'buble-config-rhino';
import type {RollupOptions} from 'rollup';

// Separate bundle: cannot accidentally import the mutating philter entrypoint.
const config: RollupOptions = {
  external: ['kolmafia', 'philter.util.ash', 'zlib.ash'],
  input: 'src/don-report.ts',
  output: {
    file: '../../release/scripts/don_philter_report.js',
    format: 'cjs',
  },
  plugins: [
    nodeResolve(),
    typescript({tsconfig: 'src/tsconfig.json'}),
    buble(createBubleConfig()),
  ],
  treeshake: {moduleSideEffects: id => id !== 'philter.util.ash'},
};
export default config;
