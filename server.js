import { WebSocketServer } from "ws";
import http from "http";
import fs from "fs";
import crypto from "crypto";

const PORT = process.env.PORT || 3000;

// HTTP server (serves index.html)
const server = http.createServer((req, res) => {
  if (req.url === "/" || req.url === "/index.html") {
    const html = fs.readFileSync("./index.html");
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(html);
  }
});

const wss = new WebSocketServer({ server });

const rooms = {}; 
// rooms[roomId] = { host: ws, viewers: Map }

wss.on("connection", ws => {
  ws.on("message", raw => {
    const data = JSON.parse(raw);

    if (data.type === "create-room") {
      rooms[data.roomId] = { host: ws, viewers: new Map() };
      ws.roomId = data.roomId;
      ws.role = "host";
    }

    else if (data.type === "join-room") {
      const room = rooms[data.roomId];
      if (!room) return;

      const viewerId = crypto.randomUUID();
      room.viewers.set(viewerId, ws);

      ws.roomId = data.roomId;
      ws.role = "viewer";
      ws.viewerId = viewerId;

      room.host.send(JSON.stringify({
        type: "viewer-joined",
        viewerId
      }));
    }

    else if (["offer", "answer", "candidate"].includes(data.type)) {
      const room = rooms[ws.roomId];
      if (!room) return;

      if (ws.role === "host") {
        room.viewers.get(data.target)?.send(JSON.stringify(data));
      } else {
        room.host.send(JSON.stringify({
          ...data,
          viewerId: ws.viewerId
        }));
      }
    }
  });

  ws.on("close", () => {
    const room = rooms[ws.roomId];
    if (!room) return;

    if (ws.role === "host") {
      delete rooms[ws.roomId];
    } else {
      room.viewers.delete(ws.viewerId);
    }
  });
});

server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
