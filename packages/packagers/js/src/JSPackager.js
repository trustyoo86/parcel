// @flow

import {Packager} from '@parcel/plugin';
import fs from 'fs';

const PRELUDE = fs
  .readFileSync(__dirname + '/prelude.js', 'utf8')
  .trim()
  .replace(/;$/, '');

export default new Packager({
  async package(bundle) {
    let promises = [];
    bundle.assetGraph.traverseAssetsWithReferences(({type, asset}) => {
      promises.push(type === 'asset' ? asset.getOutput() : Promise.resolve());
    });
    let outputs = await Promise.all(promises);

    let assets = '';
    let i = 0;
    bundle.assetGraph.traverseAssetsWithReferences(({asset}) => {
      let deps = {};

      let dependencies = bundle.assetGraph.getDependencies(asset);
      for (let dep of dependencies) {
        let resolved = bundle.assetGraph.getDependencyResolution(dep);
        if (resolved) {
          deps[dep.moduleSpecifier] = resolved.id;
        }
      }

      let output = outputs[i];
      let wrapped = i === 0 ? '' : ',';
      wrapped +=
        JSON.stringify(asset.id) +
        ':[function(require,module,exports) {\n' +
        ((output && output.code) || '') +
        '\n},';
      wrapped += JSON.stringify(deps);
      wrapped += ']';

      i++;
      assets += wrapped;
    });

    return (
      PRELUDE +
      '({' +
      assets +
      '},{},' +
      JSON.stringify(
        bundle.assetGraph.getEntryAssets().map(asset => asset.id)
      ) +
      ', ' +
      'null' +
      ')'
    );
  }
});
