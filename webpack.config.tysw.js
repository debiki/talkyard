const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

module.exports = {
  mode: 'development',

  entry: {
    serviceworker: './client/serviceworker-wptest/service-worker.ts',
    app: './client/webpacktest/src/index.ts',
  },

  devtool: 'inline-source-map',

  devServer: {
    contentBase: './dist',
  },

  plugins: [
    new HtmlWebpackPlugin({
      title: 'Output Management',
    }),
    new CleanWebpackPlugin({
      cleanStaleWebpackAssets: false,
    }),
  ],

  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'images/web/assets/wp/'),
  },

  resolve: {
    extensions: [ '.tsx', '.ts', '.js' ],
  },

  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        include: [
          /client\/webpacktest/,
          /client\/serviceworker-wptest/,
        ],
        // Has no effect
        //exclude: /node_modules/,

        //xxinclude: [
        //  path.resolve(__dirname, 'src'),
        //],
      },
      //{
      //  test: /\.css$/,
      //  use: [
      //    'style-loader',
      //    'css-loader',
      //  ],
      //},
    ],
  },
};
