import assert from 'assert';
import {readFile} from '@parcel/fs';
import path from 'path';
import {bundle} from './utils';
import {mkdirp} from '@parcel/fs';
import defaultConfigContents from '@parcel/config-default';

const jsonConfig = {
  ...defaultConfigContents,
  reporters: ['@parcel/reporter-json'],
  filePath: require.resolve('@parcel/config-default')
};

describe('json reporter', () => {
  it('logs bundling a commonjs bundle to stdout as json', async () => {
    let stdout = '';
    let oldConsoleLog = console.log;
    let i = 0;
    console.log = function log(msg) {
      let parsed = JSON.parse(msg);
      if (i === 0) {
        assert.deepEqual(parsed, {type: 'buildStart'});
      } else if (i > 0 && i < 9) {
        assert.equal(parsed.type, 'buildProgress');
        assert.equal(parsed.phase, 'transforming');
        assert(typeof parsed.filePath === 'string');
      } else if (i === 9) {
        assert.deepEqual(parsed, {
          type: 'buildProgress',
          phase: 'bundling'
        });
      } else if (i === 10) {
        assert.deepEqual(parsed, {
          type: 'buildProgress',
          phase: 'packaging',
          bundleFilePath: 'dist/index.js'
        });
      } else if (i === 11) {
        assert.equal(parsed.type, 'buildSuccess');
        assert(typeof parsed.buildTime === 'number');
        assert(Array.isArray(parsed.bundles));
        let bundle = parsed.bundles[0];
        assert.equal(bundle.filePath, 'dist/index.js');
        assert(typeof bundle.size === 'number');
        assert(typeof bundle.time === 'number');
        assert(Array.isArray(bundle.largestAssets));
      } else {
        assert.fail(`Unexpected message ${msg} in position ${i}`);
      }

      i++;
    };

    try {
      let b = await bundle(
        path.join(__dirname, '/integration/commonjs/index.js'),
        {defaultConfig: jsonConfig}
      );
    } catch (e) {
      throw e;
    } finally {
      console.log = oldConsoleLog;
    }
  });
});
