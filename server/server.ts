//require our websocket library
import * as Websocket from 'ws';
import * as winston from 'winston';
import { uuid } from 'uuidv4';

const WebSocketServer = Websocket.Server;

const port = process.env.PORT || 3000;
var wss = new WebSocketServer({ port: +port });

const logger = winston.createLogger({
	level: 'info',
	transports: [
		new winston.transports.File({
			filename: 'logs/error.log',
			level: 'error',
		}),
		new winston.transports.File({
			filename: 'logs/combined.log',
			level: 'info',
		}),
	],
});

interface WebsocketV2 extends Websocket {
	username: string;
}

interface Player {
	info: {
		id: string;
		username: string;
	};
	ws: WebsocketV2;
}

const player = {};
let players = [];

//when a user connects to our sever
wss.on('connection', function (connection: WebsocketV2) {
	console.log('CONNECTED');
	try {
		connection.on('message', function (rawMessage: Websocket.RawData) {
			var data;
			const message: string = rawMessage.toString();

			try {
				data = JSON.parse(message);
				console.log(data, ' message');
			} catch (e) {
				console.log('Invalid JSON');
				logger.error(`INVALID-JSON`);
				data = {};
			}

			switch (data.type) {
				case 'login':
					handleLogin(connection, data);
					break;
				case 'connection':
					handleConnections(
						data.username,
						data.connectionId,
						data.opponentUsername
					);
					break;
				case 'offer':
					handleOffer(
						data.offer,
						data.username,
						data.opponentUsername
					);
					break;
				case 'answer':
					handleAnswer(
						data.answer,
						data.username,
						data.opponentUsername
					);
					break;
				case 'candidate':
					handleCandidate(
						data.candidate,
						data.username,
						data.opponentUsername
					);
					break;
				case 'resetRoom':
					resetRoom();
					break;
				case 'roomInfo':
					getRoomInfo(data.username);
					break;
				case 'disconnectFromRoom':
					leaveRoom(data.username);
					break;
				case 'startMatch':
					startMatch();
					break;
				default:
					sendTo(connection, {
						type: 'error',
						message: 'Command not found: ' + data.type,
					});

					logger.error(`ERROR: Command not found: ${data.type}`);

					break;
			}
		});

		connection.on('close', function (data) {
			removePlayer(connection.username);
			logger.info(`ON-CLOSE-REMOVE-PLAYER: ${connection.username}`);
		});

		connection.send(JSON.stringify({ type: 'players', players: players }));

		logger.info('Connection established.');
	} catch (error) {
		console.log('ERR: ', error);
		logger.error(`ERROR: ${error}`);
	}
});

function handleCandidate(candidate, username, opponentUsername) {
	const player = players.find(
		currentUser => currentUser.info.username === opponentUsername
	);

	sendTo(player.ws, {
		type: 'candidate',
		candidate: candidate,
		senderUsername: username,
		opponentUsername: opponentUsername,
	});

	logger.info(
		`[HANDLE-CANDIDATE]_username: ${username} | opponent_username: ${opponentUsername}`
	);
}

function handleAnswer(answer, username, opponentUsername) {
	const player = players.find(
		currentUser => currentUser.info.username === opponentUsername
	);

	sendTo(player.ws, {
		type: 'answer',
		answer: answer,
		senderUsername: username,
		opponentUsername: opponentUsername,
	});

	logger.info(
		`[HANDLE-ANSWER]_username: ${username} | opponent_username: ${opponentUsername}`
	);
}

function handleOffer(offer, username, opponentUsername) {
	const player = players.find(
		currentUser => currentUser.info.username === opponentUsername
	);

	sendTo(player.ws, {
		type: 'offer',
		offer: offer,
		senderUsername: username,
		opponentUsername: player.info.username,
		test: 'tes',
	});

	logger.info(
		`[HANDLE-OFFER]_username: ${username} | opponent_username: ${opponentUsername}`
	);
}

function handleConnections(username, connectionId, opponentUsername) {
	broadcastMessage('connection', username, connectionId, opponentUsername);

	logger.info(
		`[HANDLE-CONNECTIONS] username: ${username} | opponent_username: ${opponentUsername} | connectionId: ${connectionId}`
	);
}

function handleLogin(connection, data) {
	const player = players.find(
		currentUser => currentUser.username === data.username
	);

	if (player) {
		return sendTo(connection, {
			type: 'error',
			message: 'user with that username already exist',
		});
	}

	const newPlayer = storeUser(connection, data.username);

	const playersInfo = getPlayersPayload();

	sendTo(connection, {
		type: 'login',
		success: true,
		username: data.username,
		playersInfo:
			playersInfo.length === 1 ? [] : filterPlayers(data.username),
	});

	logger.info(`[HANDLE-LOGIN]: data: ${data}`);
}

function filterPlayers(username) {
	const playersInfo = getPlayersPayload();

	return playersInfo.filter(
		currentPlayer => currentPlayer.username !== username
	);
}

function removePlayer(username) {
	const userIndex = players.findIndex(
		currentPlayer => currentPlayer.info.username === username
	);

	players.splice(userIndex, 1);

	for (let i = 0; i < players.length; i++) {
		const player = players[i];

		sendTo(player.ws, { type: 'disconnect', username: username });
	}

	logger.info(`[REMOVE-PLAYER] - username: ${username}`);
}

function broadcastMessage(type, username, connectionId, opponentUsername) {
	const player = players.find(
		currentUser => currentUser.info.username === opponentUsername
	);

	sendTo(player.ws, {
		type: type,
		success: true,
		username: opponentUsername,
		opponentUsername: username,
		connectionId,
	});

	logger.info(
		`[BROADCAST-MESSAGE] - username: ${username} | opponent_username: ${opponentUsername} | connectionId: ${connectionId}`
	);
}

function storeUser(connection: WebsocketV2, username: string) {
	connection.username = username;

	const newPlayer: Player = {
		info: {
			id: uuid(),
			username: username,
		},
		ws: connection,
	};

	players.push(newPlayer);

	return newPlayer;
}

function sendTo(connection, message) {
	connection.send(JSON.stringify(message));

	logger.info(`[SEND-TO] - message: ${JSON.stringify(message)}`);
}

function getPlayersPayload() {
	const playersInfo = [];
	Object.keys(players).forEach(key => {
		const player = players[key].info;
		playersInfo.push({ ...player });
	});
	return playersInfo;
}

function resetRoom() {
	for (let i = 0, len = players.length; i < len; i++) {
		const player = players[i];

		sendTo(player.ws, { type: 'resetRoom', status: true });
	}
	players = [];
	logger.info(`[RESET-ROOM]`);
}

function getRoomInfo(username) {
	const playersRoomLength = players.length;

	const user = players.find(
		currentPlayer => currentPlayer.info.username === username
	);

	const playersInfo = players.map(currentPlayer => currentPlayer.info);

	sendTo(user.ws, {
		type: 'roomInfo',
		info: {
			playersRoomLength: playersRoomLength,
			playersInfo: playersInfo,
		},
	});
	logger.info(`[GET-ROOM-INFO] - username: ${username}`);
}

function startMatch() {
	for (let i = 0; i < players.length; i++) {
		const player = players[i];

		sendTo(player.ws, {
			type: 'startMatch',
			success: true,
		});
	}
}

function leaveRoom(username) {}

console.log('listening...');
