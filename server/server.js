const http = require("http");
const WebSocket = require("ws");
const express = require("express");
const path = require("path");

const app = express();

// Serve the React build that the Dockerfile copies into ./public
app.use(express.static(path.join(__dirname, "public")));

// SPA fallback — any unknown route serves index.html so React Router works
app.get("/*splat", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let users = [];

wss.on("connection", (ws) => {
  console.log("User connected");
  users.push(ws);

  if (users.length === 2) {
    users[1].send(JSON.stringify({ type: "start-call" }));
  }

  ws.on("message", (message) => {
    let data;
    try { data = JSON.parse(message); } catch { return; }

    users.forEach((user) => {
      if (user !== ws) user.send(JSON.stringify(data));
    });
  });

  ws.on("close", () => {
    console.log("User disconnected");
    users = users.filter((u) => u !== ws);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
