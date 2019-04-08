// @flow strict-local

import type {FilePath} from '@parcel/types';
import {Reporter} from '@parcel/plugin';

export default new Reporter({
  async report(event) {
    if (
      process.env.PARCEL_DUMP_GRAPH == null ||
      event.type !== 'buildProgress'
    ) {
      return;
    }

    switch (event.phase) {
      case 'bundling':
        event.assetGraph._dumpToGraphViz('MainAssetGraph').then(printPath);
        break;
      case 'bundleFinished':
        event.bundleGraph._dumpToGraphViz('BundleGraph').then(printPath);
        event.bundleGraph.traverseBundles(bundle => {
          bundle._dumpToGraphViz(bundle.id).then(printPath);
        });
        break;
    }
  }
});

function printPath(imgPath: FilePath) {
  // eslint-disable-next-line no-console
  console.log(`open ${imgPath}`);
}
