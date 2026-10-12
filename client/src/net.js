import Peer from "peerjs";

// Modelo P2P: el móvil del anfitrión es el "servidor". Los demás conectan directamente a él.
// El anfitrión guarda el estado autoritativo (y, más adelante, los secretos de cada jugador).
const PREFIX = "misterio-";
const HOST_ID = "host";
export const MIN_PLAYERS = 2;
export const LEVELS = ["bajo", "medio", "alto"];

// Preferencia privada del jugador en el lobby: ¿quiere ser "el malo" y con qué nivel?
// null = aún sin elegir. El jugador está "listo" cuando ha elegido las dos.
const cleanPrefs = (p) => ({
  villain: typeof p?.villain === "boolean" ? p.villain : null,
  level: LEVELS.includes(p?.level) ? p.level : null,
});
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";

const makeCode = () =>
  Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join("");

// La foto de perfil llega como data URL JPEG pequeña; el anfitrión descarta cualquier otra cosa.
const MAX_PHOTO_CHARS = 30000;
const cleanPhoto = (photo) =>
  typeof photo === "string" && photo.startsWith("data:image/jpeg;base64,") && photo.length <= MAX_PHOTO_CHARS
    ? photo
    : null;

// profile: { name, photo }
// handlers: { onRoom(room), onChat(msg), onClosed(reason) }
// Devuelven una promesa con { code, myId, isHost, sendChat(text), close() }

export function createRoom(profile, handlers, attempt = 0) {
  return new Promise((resolve, reject) => {
    const code = makeCode();
    const peer = new Peer(PREFIX + code);
    const conns = new Map(); // peerId -> DataConnection
    const room = {
      code,
      hostId: HOST_ID,
      phase: "lobby",
      players: [{ id: HOST_ID, name: profile.name, photo: cleanPhoto(profile.photo), ready: false }],
    };
    let opened = false;
    const prefs = new Map(); // peerId -> { villain, level }. Solo en el anfitrión, no se difunde.

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

    // Guarda la preferencia (privada) y difunde solo si el jugador está listo (sin revelar qué eligió).
    const applyPrefs = (id, p) => {
      const clean = cleanPrefs(p);
      prefs.set(id, clean);
      const player = room.players.find((x) => x.id === id);
      if (player) player.ready = clean.villain !== null && clean.level !== null;
      publish();
    };

    peer.on("error", (err) => {
      if (!opened && err.type === "unavailable-id" && attempt < 5) {
        peer.destroy();
        createRoom(profile, handlers, attempt + 1).then(resolve, reject);
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
        sendChat: (text) => chat(profile.name, text),
        setPrefs: (p) => {
          if (room.phase === "lobby") applyPrefs(HOST_ID, p);
        },
        startGame: () => {
          if (room.phase !== "lobby" || room.players.length < MIN_PLAYERS) return;
          room.phase = "playing";
          publish();
        },
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
          room.players.push({
            id: conn.peer,
            name: String(data.name).slice(0, 20) || "Anónimo",
            photo: cleanPhoto(data.photo),
            ready: false,
          });
          conn.send({ t: "welcome", you: conn.peer });
          publish();
        } else if (data.t === "prefs") {
          if (room.phase === "lobby" && conns.has(conn.peer)) applyPrefs(conn.peer, data);
        } else if (data.t === "chat") {
          const p = room.players.find((x) => x.id === conn.peer);
          if (p) chat(p.name, data.text);
        }
      });
      conn.on("close", () => {
        conns.delete(conn.peer);
        prefs.delete(conn.peer);
        room.players = room.players.filter((p) => p.id !== conn.peer);
        publish();
      });
    });
  });
}

export function joinRoom(code, profile, handlers) {
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

      conn.on("open", () => conn.send({ t: "join", name: profile.name, photo: profile.photo }));
      conn.on("data", (data) => {
        if (data.t === "welcome") {
          clearTimeout(timeout);
          settled = true;
          resolve({
            code: code.toUpperCase(),
            myId: data.you,
            isHost: false,
            sendChat: (text) => conn.send({ t: "chat", text }),
            setPrefs: (p) => conn.send({ t: "prefs", ...cleanPrefs(p) }),
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
