import { useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { createRoom, joinRoom } from "./net.js";

const NAME_KEY = "misterio:nombre";
const PHOTO_KEY = "misterio:foto";
const PHOTO_SIZE = 128;

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

  const start = async (fn) => {
    setBusy(true);
    setError("");
    try {
      const s = await fn();
      sessionRef.current = s;
      setSession(s);
    } catch (e) {
      setError(e.message || "No se pudo conectar");
    } finally {
      setBusy(false);
    }
  };

  const leave = () => {
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
        {joinCode ? (
          <button disabled={!name || busy} onClick={() => start(() => joinRoom(joinCode, { name, photo }, handlers))}>
            {busy ? "Conectando…" : `Unirme a la sala ${joinCode}`}
          </button>
        ) : (
          <>
            <button disabled={!name || busy} onClick={() => start(() => createRoom({ name, photo }, handlers))}>
              {busy ? "Creando…" : "Crear sala (soy el anfitrión)"}
            </button>
            <div className="row">
              <input placeholder="Código" value={code} maxLength={4} onChange={(e) => setCode(e.target.value.toUpperCase())} />
              <button style={{ width: "auto" }} disabled={!name || code.length !== 4 || busy} onClick={() => start(() => joinRoom(code, { name, photo }, handlers))}>
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
      {session.isHost && (
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
            <li key={p.id} className="player">
              <Avatar photo={p.photo} name={p.name} />
              <span>{p.name} {p.id === room.hostId && "👑"} {p.id === session.myId && "(tú)"}</span>
            </li>
          ))}
        </ul>
      </div>
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
