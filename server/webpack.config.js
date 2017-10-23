var path = require('path');
var ExtractTextPlugin = require('extract-text-webpack-plugin');

module.exports = {
	entry: {
		main: './web/scripts/client.js',
		admin: './web/scripts/admin.js',
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
		},
		{
			test: /\.(eot|svg|ttf|woff|woff2)$/,
			use: [
			{
				loader: 'file-loader',
				options: {
					name: 'fonts/[hash].[ext]'
				}
			}
			]
		}
		],
	},
	plugins: [
	new ExtractTextPlugin('styles/[name].css'),
	]
};