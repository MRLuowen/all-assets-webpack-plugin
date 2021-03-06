var merge = require('lodash.merge');
var fs = require('fs')
var getAssetKind = require('./lib/getAssetKind');
var isHMRUpdate = require('./lib/isHMRUpdate');
var isSourceMap = require('./lib/isSourceMap');

var createQueuedWriter = require('./lib/output/createQueuedWriter');
var createOutputWriter = require('./lib/output/createOutputWriter');


function AssetsWebpackPlugin (options) {
  this.options = merge({}, {
    path: '.',
    filename: 'webpack-assets.json',
    prettyPrint: false,
    update: false,
    fullPath: true
  }, options);
  this.writer = createQueuedWriter(createOutputWriter(this.options));
}

AssetsWebpackPlugin.prototype = {

  constructor: AssetsWebpackPlugin,

  apply: function (compiler) {
    var self = this;

    compiler.plugin('after-emit', function (compilation, callback) {

      var options = compiler.options;
      var stats = compilation.getStats().toJson({
        hash: true,
        publicPath: true,
        assets: true,
        chunks: false,
        modules: false,
        source: false,
        errorDetails: false,
        timings: false
      });
            // publicPath with resolved [hash] placeholder

      var assetPath = (stats.publicPath && self.options.fullPath) ? stats.publicPath : '';
            // assetsByChunkName contains a hash with the bundle names and the produced files
            // e.g. { one: 'one-bundle.js', two: 'two-bundle.js' }
            // in some cases (when using a plugin or source maps) it might contain an array of produced files
            // e.g. {
            // main:
            //   [ 'index-bundle-42b6e1ec4fa8c5f0303e.js',
            //     'index-bundle-42b6e1ec4fa8c5f0303e.js.map' ]
            // }
      var assetsByChunkName = stats.assetsByChunkName;

      var output = Object.keys(assetsByChunkName).reduce(function (chunkMap, chunkName) {
        var assets = assetsByChunkName[chunkName];
        if (!Array.isArray(assets)) {
          assets = [assets];
        }
        // 针对魔方做一些特殊处理
        if (chunkName.match(/\//)) {
          var tempname = chunkName.split('/').pop();
          if (chunkMap[tempname]) {
              console.log('组件和其他产品线重名了', chunkName);
              process.exit(-1);
          } else {
              chunkName = tempname;
          }
        }
        chunkMap[chunkName] = assets.reduce(function (typeMap, asset) {
          if (isHMRUpdate(options, asset) || isSourceMap(options, asset)) {
            return typeMap;
          }

          var typeName = getAssetKind(options, asset);
          typeMap[typeName] = assetPath + asset;

          return typeMap;
        }, {});

        return chunkMap;
      }, {});

      if (self.options.metadata) {
        output.metadata = self.options.metadata;
      }

      //额外添加 字体文件，音频文件
      output.fontResource = {};
      output.musicResource = {};
      var allassets = stats.assets;
      for( var asset of allassets ){
        if(asset.name.match(/\.ttf$/)){
          var key = asset.name.split('.')[0];
          output.fontResource[key] = assetPath + asset.name;
        }
        if(asset.name.match(/\.mp3$/)){
          var key = asset.name.split('.')[0];
          output.musicResource[key] = assetPath + asset.name;
        }
      }

      self.writer(output, function (err) {
        if (err) {
          compilation.errors.push(err);
        }
        callback();
      });

    });
  }
};

module.exports = AssetsWebpackPlugin;
