const autoprefixer = require('autoprefixer');
const excludeNodeModulesExcept = require('../.webpack/excludeNodeModulesExcept.js');
const path = require('path');
const { output } = require('./webpack.config.js');
const exclude = excludeNodeModulesExcept([]);

module.exports = [
  {
    test: /\.(mjs|ts|tsx|js|jsx)?$/,
    exclude,
    loader: 'babel-loader',
    options: {
      // Find babel.config.js in monorepo root
      // https://babeljs.io/docs/en/options#rootmode
      rootMode: 'upward',
      envName: 'development',
    },
  },
  {
    test: /\.wasm$/,
    type: 'asset/inline',
  },
  {
    test: /\.nii\.gz$/,
    type: 'asset/resource',
    include:[
      path.resolve(__dirname, '../nifti')
    ],
    generator:{
      filename: 'static/nifti/[hash][ext][query].nii.gz'
    }
  },
  {
    test: /\.nii$/,
    type: 'asset/resource',
    include:[
      path.resolve(__dirname, '../nifti')
    ],
    generator:{
      filename: 'static/nifti/[hash][ext][query].nii'
    }
  },
  {
    // 处理html中img等标签引入的图片资源所需loader安装指令：npm i html-loader  -D
    test: /\.html$/,
    loader: "html-loader", // 处理url-loader仅能处理打包图片而不能处理html中资源的遗留问题。
    include:[
      path.resolve(__dirname, './')
    ],
  },
  {
    test: /\.css$/i,
    use: [
      'style-loader',//将js文件读取到html中
      'css-loader',
    ],
  },
  {
    test: /\.(png|jpg|gif)$/i,
    type: "asset",
    include:[
      path.resolve(__dirname, './')
    ],
  }
];
