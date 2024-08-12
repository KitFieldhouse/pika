const webpack = require('webpack');
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const config = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    clean: true
  },
  devtool: "eval-source-map",
  devServer: {
    static: "./dist",
    proxy: {
      '/hello/' : {
        target: 'https://localhost:8442',
        secure: false,
        changeOrigin: true 
      }
    }
  },
  mode: "development",
  module: {
    rules: [
      {
        test: /\.css/,
        use: ["style-loader", "css-loader"]
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif|glsl)$/i,
        type: 'asset/resource',
      }
    ]
  },

  plugins: [

    new HtmlWebpackPlugin({

      title: 'Output Management',
      template: './src/index.html'

    }),

  ],
};

module.exports = config;
