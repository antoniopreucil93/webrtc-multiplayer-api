require('dotenv').config();

module.exports = {
	apps: [
		{
			name: 'Multiplayer RTC Server',
			script: './server/server.js',
		},
	],
	env_development: {
		NODE_ENV: 'development',
		PORT: process.env.PORT,
	},
};
