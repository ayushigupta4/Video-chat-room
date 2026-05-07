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
    let data;
    try { data = JSON.parse(message); } catch { return; }

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
