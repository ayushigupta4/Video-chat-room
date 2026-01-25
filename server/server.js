const http = require("http");
const WebSocket = require("ws");

const server = http.createServer();
const wss = new WebSocket.Server({ server });

let users = []; // max 2 users

wss.on("connection", (ws) => {
  console.log("User connected");

  users.push(ws);

  // Tell second user to start the call
  if (users.length === 2) {
    users[1].send(JSON.stringify({ type: "start-call" }));
  }

  ws.on("message", (message) => {
    const data = JSON.parse(message);

    // Relay message to the OTHER user
    users.forEach((user) => {
      if (user !== ws) {
        user.send(JSON.stringify(data));
      }
    });
  });

  ws.on("close", () => {
    console.log("User disconnected");
    users = users.filter((u) => u !== ws);
  });
});

server.listen(3001, () =>
  console.log("Server listening on port 3001")
);
