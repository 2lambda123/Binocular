'use strict';

import webpack from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import path from 'path';
import { fileURLToPath } from 'url';

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cssModulesLoader = {
  loader: 'css-loader',
  options: {
    importLoaders: 1,
    modules: {
      localIdentName: '[name]__[local]__[hash:base64:5]',
    },
  },
};

const cssLoaders = [
  // loaders for loading external css
  {
    test: /\.s[ac]ss$/,
    include: path.resolve(__dirname, 'node_modules'),
    exclude: path.resolve(__dirname, 'ui'),
    use: [{ loader: 'style-loader' }, { loader: 'css-loader' }, { loader: 'sass-loader' }],
  },
  {
    test: /\.css$/,
    include: path.resolve(__dirname, 'node_modules'),
    exclude: path.resolve(__dirname, 'ui'),
    use: [{ loader: 'style-loader' }, { loader: 'css-loader' }],
  },

  // loaders for custom css
  {
    test: /\.css$/,
    exclude: path.resolve(__dirname, 'node_modules'),
    use: [{ loader: 'style-loader' }, cssModulesLoader],
  },
  {
    test: /\.s[ac]ss$/,
    exclude: [path.resolve(__dirname, 'node_modules'), path.resolve(__dirname, 'ui/src/global.scss')],
    use: [{ loader: 'style-loader' }, cssModulesLoader, { loader: 'sass-loader' }],
  },
  {
    test: /global\.scss$/,
    include: path.resolve(__dirname, 'ui/src/global.scss'),
    use: [{ loader: 'style-loader' }, { loader: 'css-loader' }, { loader: 'sass-loader' }],
  },
];

export const entry = ['./ui/src'];
export const output = {
  path: path.join(__dirname, '/dist'),
  filename: 'bundle.js',
};
export const module = {
  rules: [
    { test: /\.jsx?$/, exclude: /node_modules/, loader: 'babel-loader' },
    {
      test: /\.tsx?$/,
      use: 'ts-loader',
      exclude: /node_modules/,
    },
    ...cssLoaders,
    {
      test: /\.svg$/,
      use: [
        {
          loader: 'svg-url-loader',
          options: {
            limit: 10000,
          },
        },
      ],
    },
    {
      test: /\.(ttf|eot|woff)/,
      include: [path.resolve(__dirname, 'node_modules')],
      loader: 'file-loader',
    },
    {
      test: /\.m?js/,
      resolve: {
        fullySpecified: false,
      },
    },
  ],
};
export const plugins = [
  new HtmlWebpackPlugin({ template: './ui/index.html' }),
  new webpack.ProvidePlugin({
    Buffer: ['buffer', 'Buffer'],
  }),
  new webpack.ProvidePlugin({
    React: 'react',
  }),
  new webpack.ProvidePlugin({
    process: 'process/browser',
  }),
  new webpack.LoaderOptionsPlugin({ debug: true }),
];
export const resolve = {
  extensions: ['.tsx', '.ts', '.js'],
  alias: {
    http: 'stream-http',
    https: 'https-browserify',
    stream: 'stream-browserify',
    zlib: 'browserify-zlib',
  },
  fallback: {
    url: require.resolve('url/'),
    util: require.resolve('util/'),
    assert: require.resolve('assert/'),
    crypto: require.resolve('crypto-browserify'),
    buffer: require.resolve('buffer'),
  },
};
