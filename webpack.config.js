var path = require('path');
var ExtractTextPlugin = require('extract-text-webpack-plugin');

module.exports = {
	entry: {
		main: './web/scripts/main.js'
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