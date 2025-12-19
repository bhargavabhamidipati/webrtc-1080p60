import { WebSocketServer } from "ws";
import crypto from "crypto";

const wss = new WebSocketServer({ port: 3000 });
const rooms = {}; 
// rooms[roomId] = { host: ws, viewers: Map<viewerId, ws> }

wss.on("connection", ws => {
  ws.on("message", raw => {
    const data = JSON.parse(raw);

    // CREATE ROOM
    if (data.type === "create-room") {
      rooms[data.roomId] = {
        host: ws,
        viewers: new Map()
      };
      ws.roomId = data.roomId;
      ws.role = "host";
      console.log(`Room created: ${data.roomId}`);
    }

    // JOIN ROOM
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

    // SIGNALING (targeted)
    else if (["offer", "answer", "candidate"].includes(data.type)) {
      const room = rooms[ws.roomId];
      if (!room) return;

      if (ws.role === "host") {
        const viewer = room.viewers.get(data.target);
        if (viewer) viewer.send(JSON.stringify(data));
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
      console.log(`Room closed: ${ws.roomId}`);
    } else {
      room.viewers.delete(ws.viewerId);
    }
  });
});

console.log("✅ Signaling server running on ws://localhost:3000");
