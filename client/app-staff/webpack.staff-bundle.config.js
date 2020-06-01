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
    mode: 'development',
    entry: './index.ts',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].js',
        publicPath: "/"
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
    devServer: {
        clientLogLevel: 'warning',
        open: true,
        historyApiFallback: true,
        stats: 'errors-only'
    }
};
