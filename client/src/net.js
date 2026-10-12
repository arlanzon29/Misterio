import Peer from "peerjs";

// Modelo P2P: el móvil del anfitrión es el "servidor". Los demás conectan directamente a él.
// El anfitrión guarda el estado autoritativo (y, más adelante, los secretos de cada jugador).
const PREFIX = "misterio-";
const HOST_ID = "host";
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";

const makeCode = () =>
  Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join("");

// handlers: { onRoom(room), onChat(msg), onClosed(reason) }
// Devuelven una promesa con { code, myId, isHost, sendChat(text), close() }

export function createRoom(name, handlers, attempt = 0) {
  return new Promise((resolve, reject) => {
    const code = makeCode();
    const peer = new Peer(PREFIX + code);
    const conns = new Map(); // peerId -> DataConnection
    const room = { code, hostId: HOST_ID, phase: "lobby", players: [{ id: HOST_ID, name }] };
    let opened = false;

    const broadcast = (msg) => conns.forEach((c) => c.open && c.send(msg));
    const publish = () => {
      handlers.onRoom({ ...room, players: [...room.players] });
      broadcast({ t: "room", room });
    };
    const chat = (from, text) => {
      const msg = { from, text: String(text).slice(0, 300) };
      handlers.onChat(msg);
      broadcast({ t: "chat", ...msg });
    };

    peer.on("error", (err) => {
      if (!opened && err.type === "unavailable-id" && attempt < 5) {
        peer.destroy();
        createRoom(name, handlers, attempt + 1).then(resolve, reject);
      } else if (!opened) {
        reject(new Error("No se pudo crear la sala: " + err.type));
      } else {
        handlers.onClosed?.(err.type);
      }
    });

    peer.on("open", () => {
      opened = true;
      publish();
      resolve({
        code,
        myId: HOST_ID,
        isHost: true,
        sendChat: (text) => chat(name, text),
        close: () => peer.destroy(),
      });
    });

    peer.on("connection", (conn) => {
      conn.on("data", (data) => {
        if (data.t === "join") {
          if (room.phase !== "lobby") {
            conn.send({ t: "error", error: "La partida ya empezó" });
            return;
          }
          conns.set(conn.peer, conn);
          room.players.push({ id: conn.peer, name: String(data.name).slice(0, 20) || "Anónimo" });
          conn.send({ t: "welcome", you: conn.peer });
          publish();
        } else if (data.t === "chat") {
          const p = room.players.find((x) => x.id === conn.peer);
          if (p) chat(p.name, data.text);
        }
      });
      conn.on("close", () => {
        conns.delete(conn.peer);
        room.players = room.players.filter((p) => p.id !== conn.peer);
        publish();
      });
    });
  });
}

export function joinRoom(code, name, handlers) {
  return new Promise((resolve, reject) => {
    const peer = new Peer();
    let settled = false;
    const fail = (message) => {
      if (!settled) {
        settled = true;
        peer.destroy();
        reject(new Error(message));
      } else {
        handlers.onClosed?.(message);
      }
    };

    peer.on("error", (err) =>
      fail(err.type === "peer-unavailable" ? "Sala no encontrada" : "Error de conexión: " + err.type)
    );

    peer.on("open", () => {
      const conn = peer.connect(PREFIX + code.toUpperCase(), { reliable: true });
      const timeout = setTimeout(() => fail("No se pudo conectar con el anfitrión"), 15000);

      conn.on("open", () => conn.send({ t: "join", name }));
      conn.on("data", (data) => {
        if (data.t === "welcome") {
          clearTimeout(timeout);
          settled = true;
          resolve({
            code: code.toUpperCase(),
            myId: data.you,
            isHost: false,
            sendChat: (text) => conn.send({ t: "chat", text }),
            close: () => peer.destroy(),
          });
        } else if (data.t === "room") {
          handlers.onRoom(data.room);
        } else if (data.t === "chat") {
          handlers.onChat({ from: data.from, text: data.text });
        } else if (data.t === "error") {
          clearTimeout(timeout);
          fail(data.error);
        }
      });
      conn.on("close", () => {
        clearTimeout(timeout);
        fail("El anfitrión se desconectó");
      });
    });
  });
}
