import { createServer } from "node:http";
import { Server } from "socket.io";

const PORT = process.env.PORT || 3001;
const httpServer = createServer();
const io = new Server(httpServer, { cors: { origin: "*" } });

// Estado autoritativo en memoria: code -> { code, hostId, phase, players: Map(id -> player) }
const rooms = new Map();

const makeCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code;
  do {
    code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  } while (rooms.has(code));
  return code;
};

// Vista pública de la sala: nunca incluir información secreta aquí.
const publicView = (room) => ({
  code: room.code,
  hostId: room.hostId,
  phase: room.phase,
  players: [...room.players.values()].map(({ id, name }) => ({ id, name })),
});

const broadcast = (room) => io.to(room.code).emit("room:update", publicView(room));

io.on("connection", (socket) => {
  let currentCode = null;

  const join = (room, name, ack) => {
    room.players.set(socket.id, { id: socket.id, name: String(name).slice(0, 20) || "Anónimo" });
    socket.join(room.code);
    currentCode = room.code;
    ack?.({ ok: true, you: socket.id, room: publicView(room) });
    broadcast(room);
  };

  socket.on("room:create", ({ name }, ack) => {
    const room = { code: makeCode(), hostId: socket.id, phase: "lobby", players: new Map() };
    rooms.set(room.code, room);
    join(room, name, ack);
  });

  socket.on("room:join", ({ code, name }, ack) => {
    const room = rooms.get(String(code).toUpperCase());
    if (!room) return ack?.({ ok: false, error: "Sala no encontrada" });
    if (room.phase !== "lobby") return ack?.({ ok: false, error: "La partida ya empezó" });
    join(room, name, ack);
  });

  socket.on("chat:send", ({ text }) => {
    const room = rooms.get(currentCode);
    const player = room?.players.get(socket.id);
    if (!player) return;
    io.to(room.code).emit("chat:message", { from: player.name, text: String(text).slice(0, 300) });
  });

  socket.on("disconnect", () => {
    const room = rooms.get(currentCode);
    if (!room) return;
    room.players.delete(socket.id);
    if (room.players.size === 0) return rooms.delete(room.code);
    if (room.hostId === socket.id) room.hostId = room.players.keys().next().value;
    broadcast(room);
  });
});

httpServer.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));
