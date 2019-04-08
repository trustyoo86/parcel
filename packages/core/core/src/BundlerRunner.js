// @flow strict-local

import type AssetGraph from './AssetGraph';
import type {
  FilePath,
  Namer,
  ParcelOptions,
  TransformerRequest
} from '@parcel/types';
import type {Bundle as InternalBundle} from './types';
import type Config from './Config';

import BundleGraph from './public/BundleGraph';
import InternalBundleGraph from './BundleGraph';
import MainAssetGraph from './public/MainAssetGraph';
import {Bundle, RuntimeBundle} from './public/Bundle';
import AssetGraphBuilder from './AssetGraphBuilder';
import {report} from './ReporterRunner';

type Opts = {|
  options: ParcelOptions,
  config: Config,
  rootDir: FilePath
|};

export default class BundlerRunner {
  options: ParcelOptions;
  config: Config;
  rootDir: FilePath;

  constructor(opts: Opts) {
    this.options = opts.options;
    this.config = opts.config;
    this.rootDir = opts.rootDir;
  }

  async bundle(graph: AssetGraph): Promise<InternalBundleGraph> {
    let mainAssetGraph = new MainAssetGraph(graph);
    report({
      type: 'buildProgress',
      phase: 'bundling',
      assetGraph: mainAssetGraph
    });

    let bundler = await this.config.getBundler();

    let internalBundleGraph = new InternalBundleGraph();
    let bundleGraph = new BundleGraph(internalBundleGraph);
    await bundler.bundle(
      mainAssetGraph,
      new BundleGraph(internalBundleGraph),
      this.options
    );
    await this.nameBundles(internalBundleGraph);
    await this.applyRuntimes(internalBundleGraph);

    report({
      type: 'buildProgress',
      phase: 'bundleFinished',
      bundleGraph
    });

    return internalBundleGraph;
  }

  async nameBundles(bundleGraph: InternalBundleGraph): Promise<void> {
    let namers = await this.config.getNamers();
    let promises = [];
    bundleGraph.traverseBundles(bundle => {
      promises.push(this.nameBundle(namers, bundle));
    });

    await Promise.all(promises);
  }

  async nameBundle(
    namers: Array<Namer>,
    internalBundle: InternalBundle
  ): Promise<void> {
    let bundle = new Bundle(internalBundle);
    for (let namer of namers) {
      let filePath = await namer.name(bundle, {
        rootDir: this.rootDir
      });

      if (filePath != null) {
        internalBundle.filePath = filePath;
        return;
      }
    }

    throw new Error('Unable to name bundle');
  }

  async applyRuntimes(internalBundleGraph: InternalBundleGraph): Promise<void> {
    const build = async (
      transformerRequest: TransformerRequest
    ): Promise<AssetGraph> => {
      let builder = new AssetGraphBuilder({
        options: this.options,
        config: this.config,
        rootDir: this.rootDir,
        transformerRequest
      });

      // build a graph of just the transformed asset
      return builder.build();
    };

    let bundles = [];
    let bundleGraph = new BundleGraph(internalBundleGraph);
    internalBundleGraph.traverseBundles(bundle => {
      bundles.push(new RuntimeBundle({bundle, bundleGraph, build}));
    });

    for (let bundle of bundles) {
      let runtimes = await this.config.getRuntimes(bundle.env.context);
      for (let runtime of runtimes) {
        await runtime.apply(bundle, this.options);
      }
    }
  }
}
