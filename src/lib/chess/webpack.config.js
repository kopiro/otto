const path = require('path');
const ExtractTextPlugin = require('extract-text-webpack-plugin');

module.exports = {
	entry: {
		main: path.resolve(__dirname, './web/scripts/main.js'),
	},
	output: {
		filename: 'scripts/[name].js',
		path: path.resolve(__dirname, 'public')
	},
	module: {
		rules: [
		{
			test: /\.css$/,
			use: ExtractTextPlugin.extract({
				use: 'css-loader'
			})
		}
		]
	},
	plugins: [
	new ExtractTextPlugin('styles/main.css'),
	]
};