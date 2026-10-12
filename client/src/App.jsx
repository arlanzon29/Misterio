import { useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { createRoom, joinRoom, MIN_PLAYERS, LEVELS } from "./net.js";

const NAME_KEY = "misterio:nombre";
const PHOTO_KEY = "misterio:foto";
const PHOTO_SIZE = 128;
const PID_KEY = "misterio:id";
const ROOM_KEY = "misterio:sala";

// Identidad estable de este móvil: permite que el anfitrión nos reconozca al reconectar.
const loadPid = () => {
  try {
    let id = localStorage.getItem(PID_KEY);
    if (!id) {
      id = crypto.randomUUID?.() || String(Math.random()).slice(2) + Date.now();
      localStorage.setItem(PID_KEY, id);
    }
    return id;
  } catch {
    return String(Math.random()).slice(2) + Date.now();
  }
};

const loadRoom = () => {
  try {
    return localStorage.getItem(ROOM_KEY) || "";
  } catch {
    return "";
  }
};

const saveRoom = (value) => {
  try {
    localStorage.setItem(ROOM_KEY, value);
  } catch {
    // sin almacenamiento: no se recuerda la sala
  }
};

const loadName = () => {
  try {
    return localStorage.getItem(NAME_KEY) || "";
  } catch {
    return "";
  }
};

const saveName = (value) => {
  try {
    localStorage.setItem(NAME_KEY, value);
  } catch {
    // almacenamiento no disponible (modo privado): se ignora
  }
};

const loadPhoto = () => {
  try {
    return localStorage.getItem(PHOTO_KEY) || null;
  } catch {
    return null;
  }
};

const savePhoto = (value) => {
  try {
    localStorage.setItem(PHOTO_KEY, value);
  } catch {
    // almacenamiento no disponible: la foto solo durará esta sesión
  }
};

// Recorta al centro en cuadrado y reduce a 128x128 JPEG (unos pocos KB).
async function resizePhoto(file) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = PHOTO_SIZE;
  canvas.getContext("2d").drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    PHOTO_SIZE,
    PHOTO_SIZE
  );
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.7);
}

function Avatar({ photo, name, size = 40 }) {
  return photo ? (
    <img className="avatar" src={photo} alt={name} width={size} height={size} />
  ) : (
    <span className="avatar" style={{ width: size, height: size, lineHeight: `${size}px` }}>
      {(name || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}

export default function App() {
  const [name, setNameState] = useState(loadName);
  const setName = (value) => {
    setNameState(value);
    saveName(value);
  };
  const [photo, setPhoto] = useState(loadPhoto);
  const [pid] = useState(loadPid);
  const [lastRoom, setLastRoom] = useState(loadRoom);
  const [prefs, setPrefsState] = useState({ villain: null, level: null });
  const [code, setCode] = useState("");
  const [session, setSession] = useState(null); // { code, myId, isHost, sendChat, close }
  const [room, setRoom] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const sessionRef = useRef(null);

  const joinCode = new URLSearchParams(window.location.search).get("sala") || "";

  const handlers = {
    onRoom: setRoom,
    onChat: (m) => setMessages((prev) => [...prev, m]),
    onClosed: (reason) => {
      sessionRef.current = null;
      setSession(null);
      setRoom(null);
      setMessages([]);
      setError(reason);
    },
  };

  const onPickPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const resized = await resizePhoto(file);
      setPhoto(resized);
      savePhoto(resized);
    } catch {
      setError("No se pudo procesar la foto");
    }
  };

  const changePrefs = (patch) => {
    const next = { ...prefs, ...patch };
    setPrefsState(next);
    sessionRef.current?.setPrefs(next);
  };

  const start = async (fn) => {
    setBusy(true);
    setError("");
    try {
      const s = await fn();
      sessionRef.current = s;
      s.setPrefs(prefs);
      if (!s.isHost) {
        saveRoom(s.code);
        setLastRoom(s.code);
      }
      setSession(s);
    } catch (e) {
      setError(e.message || "No se pudo conectar");
      if (e.message === "Sala no encontrada") {
        saveRoom("");
        setLastRoom("");
      }
    } finally {
      setBusy(false);
    }
  };

  const leave = () => {
    saveRoom("");
    setLastRoom("");
    sessionRef.current?.close();
    sessionRef.current = null;
    setSession(null);
    setRoom(null);
    setMessages([]);
  };

  if (!session || !room) {
    return (
      <main>
        <h1>🕵️ Misterio</h1>
        <label className="photo-pick">
          <Avatar photo={photo} name={name} size={96} />
          <span>{photo ? "Cambiar foto" : "Hacerme una foto"}</span>
          <input type="file" accept="image/*" capture="user" hidden onChange={onPickPhoto} />
        </label>
        <input placeholder="Tu nombre" value={name} onChange={(e) => setName(e.target.value)} />
        {lastRoom && !joinCode && (
          <button disabled={!name || busy} onClick={() => start(() => joinRoom(lastRoom, { name, photo, pid }, handlers))}>
            {busy ? "Conectando…" : `↩️ Volver a la sala ${lastRoom}`}
          </button>
        )}
        {joinCode ? (
          <button disabled={!name || busy} onClick={() => start(() => joinRoom(joinCode, { name, photo, pid }, handlers))}>
            {busy ? "Conectando…" : `Unirme a la sala ${joinCode}`}
          </button>
        ) : (
          <>
            <button disabled={!name || busy} onClick={() => start(() => createRoom({ name, photo, pid }, handlers))}>
              {busy ? "Creando…" : "Crear sala (soy el anfitrión)"}
            </button>
            <div className="row">
              <input placeholder="Código" value={code} maxLength={4} onChange={(e) => setCode(e.target.value.toUpperCase())} />
              <button style={{ width: "auto" }} disabled={!name || code.length !== 4 || busy} onClick={() => start(() => joinRoom(code, { name, photo, pid }, handlers))}>
                Unirse
              </button>
            </div>
          </>
        )}
        {error && <p className="err">{error}</p>}
      </main>
    );
  }

  const inviteUrl = `${window.location.origin}${window.location.pathname}?sala=${room.code}`;

  return (
    <main>
      <h1>Sala {room.code}</h1>
      {room.phase === "playing" && (
        <div className="card">
          <h2>🔎 Partida en curso</h2>
          <p>La partida ha empezado.</p>
        </div>
      )}
      {session.isHost && room.phase === "lobby" && (
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span>Escanea para unirte (mantén esta pantalla abierta):</span>
          <div className="qr"><QRCodeSVG value={inviteUrl} size={180} /></div>
          <small style={{ wordBreak: "break-all" }}>{inviteUrl}</small>
        </div>
      )}
      <div className="card">
        <h3>Jugadores ({room.players.length})</h3>
        <ul>
          {room.players.map((p) => (
            <li key={p.id} className="player" style={{ opacity: p.connected === false ? 0.5 : 1 }}>
              <Avatar photo={p.photo} name={p.name} />
              <span>{p.name} {p.id === room.hostId && "👑"} {p.id === session.myId && "(tú)"} {p.ready && "✅"} {p.connected === false && "📵 desconectado"}</span>
            </li>
          ))}
        </ul>
      </div>
      {room.phase === "lobby" && (
        <div className="card">
          <h3>Tu rol {prefs.villain !== null && prefs.level !== null && "✅"}</h3>
          <div className="levels">
            <button className={prefs.villain === true ? "on" : ""} onClick={() => changePrefs({ villain: true })}>
              Malo 😈
            </button>
            <button className={prefs.villain === false ? "on" : ""} onClick={() => changePrefs({ villain: false })}>
              No malo 🙂
            </button>
          </div>
          <div className="levels">
            {LEVELS.map((l) => (
              <button key={l} className={prefs.level === l ? "on" : ""} onClick={() => changePrefs({ level: l })}>
                {l}
              </button>
            ))}
          </div>
          <small>Elige rol y nivel. Nadie ve qué eliges, solo si ya estás listo.</small>
        </div>
      )}
      {session.isHost && room.phase === "lobby" && (
        <button disabled={room.players.length < MIN_PLAYERS} onClick={() => session.startGame()}>
          {room.players.length < MIN_PLAYERS
            ? `Faltan jugadores (mínimo ${MIN_PLAYERS})`
            : "Empezar partida"}
        </button>
      )}
      {!session.isHost && room.phase === "lobby" && <p>Esperando a que el anfitrión empiece…</p>}
      <div className="card">
        <h3>Chat de prueba</h3>
        <div className="chat">
          {messages.map((m, i) => <div key={i}><b>{m.from}:</b> {m.text}</div>)}
        </div>
      </div>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          if (text) {
            session.sendChat(text);
            setText("");
          }
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Mensaje" />
        <button style={{ width: "auto" }}>Enviar</button>
      </form>
      <button style={{ background: "#3a3550" }} onClick={leave}>Salir</button>
    </main>
  );
}
