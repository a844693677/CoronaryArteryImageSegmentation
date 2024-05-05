
var shell = require('shelljs');
shell.cd("./CTA");
webpackConfigPath = "./webpack.config.js";
shell.exec(
    `webpack serve --host 0.0.0.0 --progress --config ${webpackConfigPath}`
);
