//require our websocket library
var WebSocketServer = require('ws').Server;
const { uuid } = require('uuidv4');

//creating a websocket server at port 9090
const port = process.env.PORT || 3000;
var wss = new WebSocketServer({ port: port });

//all connected to the server users
var users = {};
const player = {};
players = [];

//when a user connects to our sever
wss.on('connection', function (connection) {
	connection.on('message', function (message) {
		console.log(message, ' first message');
		var data;
		try {
			data = JSON.parse(message);
		} catch (e) {
			console.log('Invalid JSON');
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
				handleOffer(data.offer, data.username, data.opponentUsername);
				break;
			case 'answer':
				handleAnswer(data.answer, data.username, data.opponentUsername);
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
			default:
				sendTo(connection, {
					type: 'error',
					message: 'Command not found: ' + data.type,
				});

				break;
		}
	});

	connection.on('close', function (data) {
		removePlayer(connection.username);
	});

	connection.send(JSON.stringify({ type: 'players', players: users }));
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
}

function handleConnections(username, connectionId, opponentUsername) {
	broadcastMessage('connection', username, connectionId, opponentUsername);
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
}

function storeUser(connection, username) {
	connection.username = username;
	const newPlayer = {
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
}

console.log('listening...');
