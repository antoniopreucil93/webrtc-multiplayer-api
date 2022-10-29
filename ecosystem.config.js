module.exports = {
	apps: [
		{
			name: 'Multiplayer RTC Server',
			script: './server/server.js',
		},
	],
	env_development: {
		NODE_ENV: 'development',
		PORT: 3000,
	},
};
