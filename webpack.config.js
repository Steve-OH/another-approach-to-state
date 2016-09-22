var webpack = require('webpack');
var path = require('path');

module.exports = {
  entry: './src/main.js',
  output: {
    path: path.join(__dirname, 'runtime'),
    filename: 'main.js'
  },
  devtool: 'inline-source-map',
  module: {
    loaders: [
      {
        exclude: /node_modules/,
        include: [
          path.resolve(__dirname, "src"),
        ],
        loader: 'babel-loader',
        test: /\.js$/
      }
    ]
  }
};
