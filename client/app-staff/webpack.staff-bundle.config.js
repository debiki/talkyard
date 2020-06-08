/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path');
const ForkTsCheckerNotifierWebpackPlugin = require('fork-ts-checker-notifier-webpack-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
//const HtmlWebpackPlugin = require('html-webpack-plugin');

/* Too complicated:
   https://jorgeartieda.gitbook.io/typescript-from-namespaces-to-modules/solution
   Maybe but not needed:
   https://www.geekytidbits.com/typescript-progressively-convert-namespaces-to-modules/  ?
   But interesting

   export import MyClass = my_namespace.MyClass;

tsconfig.json
{
  "compilerOptions": {
    "outFile": "../dist/package.js",
    "composite": true
  },
  "include": ["** /*.ts"],
  "exclude": ["** /*.m.ts"]
}
tsconfig.module.json
{
  "compilerOptions": {
    "module": "esnext"
  }
  "files": ["./MyClass.m.ts"],
  "references": [{ "path": "./tsconfig.json" }]
}

---

Later. Fast?:  https://openbase.io/js/gulp-tsb
"found" here
 https://devblogs.microsoft.com/typescript/announcing-typescript-3-8-beta/
 “Fast and Loose” Incremental Checking

*/



// See:
// https://github.com/TypeStrong/ts-loader/blob/master/examples/fork-ts-checker-webpack-plugin/webpack.config.development.js
// https://github.com/TypeStrong/ts-loader
module.exports = {
    context: __dirname, // process.cwd(), // to automatically find tsconfig.json
    target: 'web',  // the default
      // there's also: 'webworker', https://webpack.js.org/configuration/target/
    mode: 'development',
    //mode: 'production', // PROD
    //entry: './index.ts',
    entry: {
        'staff-bundle.wp': './index.ts',
        /*
        index: {  —— won't work, sets tyStaffLib === 1, why?
            import: './index.ts',
            filename: 'staff-bundle.wp.js',
            dependOn:'shared-bundle'
        },
        // no:
                'shared-bundle': ['lodash', 'moment', 'react' ,'react-dom'],
        // instead, Externals?:
        //   https://webpack.js.org/configuration/externals/#externals
        */
    },
    output: {
        path: path.resolve('images', 'web', 'assets', 'v0.6.69-WIP-1'),
        filename: '[name].js',
        //libraryTarget: 'umd',
        libraryTarget: 'var',
        publicPath: '/',
        library: 'tyStaffLib',

        auxiliaryComment: {
            root: 'Root COMMENT',
            commonjs: 'CommonJS COMMENT',
            commonjs2: 'CommonJS2 COMMENT',
            amd: 'AMD COMMENT'
        },
    },
    plugins: [
        new ForkTsCheckerWebpackPlugin({
            //eslint: true
        }),
        new ForkTsCheckerNotifierWebpackPlugin({ title: 'TypeScript', excludeWarnings: false }),
        //new HtmlWebpackPlugin({
        //    inject: true,
        //    template: 'src/index.html'
        //}),
    ],
    module: {
        rules: [
            {
                test: /.tsx?$/,
                use: [
                    { loader: 'ts-loader', options: { transpileOnly: true } }
                ]
            }
        ]
    },
    resolve: {
        extensions: [".tsx", ".ts", ".js"]
    },
    devtool: 'inline-source-map',
    //devtool: 'source-map', // PROD
    devServer: {
        clientLogLevel: 'warning',
        open: true,
        historyApiFallback: true,
        stats: 'errors-only'
    }
};
