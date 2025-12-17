const http = require("http");
const WebSocket = require("ws");

const server = http.createServer();
const wss = new WebSocket.Server({ server });

const rooms = {};

function generateId() {
    return Math.random().toString(36).substring(2, 10);
}

wss.on("connection", (ws) => {
    ws.id = generateId();
    ws.roomId = null;
    
    ws.on("message", (message) => {
        let data = JSON.parse(message);

        switch (data.type) {
            case "join-room":
                handleJonRoom(ws, data.roomId);
                break;

            case "offer":
            case "answer":
            case "ice-candidate":
                relayToRoom(ws, data);
                break;

            case "user-left":
                handleUserLeft(ws);
                break;
        }
    });

    ws.on("close", () => {
        handleUserLeft(ws);
    })
});

function handleJoinRoom(ws, roomId) {
    ws.roomId = roomId;

    if(!rooms[roomId]) rooms[roomId] = {};

    rooms[roomId][ws.id] = ws;

    console.log(`User ${ws.id} joined room ${roomId}`);

    broadcast(roomId, {
        type: "new-use",
        userId: ws.id,
    }, ws);
}

function relayToRoom(sender, data) {
    const room = rooms[sender.roomId];
    if (!room) return;

    Object.values(room).forEach((client) => {
        if(client !== sender) {
            client.send(JSON.stringify({
                        ...data,
                        senderId: sender.id
            }));
        }
    });
}

function handleUserLeft(ws) {
    if (!ws.roomId || !rooms[ws.roomId]) return;

    delete rooms[ws.roomId][ws.id];

    broadcast(ws.roomId, {
        type: "user-left",
        userId: ws.id
    });

    console.log(`User ${ws.id} left room {ws.roomId}`);
}

function broadcast(roomId, data, exclude = null) {
    Object.values(rooms[roomId] || {}).forEach((client) => {
        if(client !== exclude) {
            client.send(JSON.stringify(data));
        }
    });
}

const PORT = 3001;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));