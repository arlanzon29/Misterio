import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { socket } from "./socket.js";

export default function App() {
  const [connected, setConnected] = useState(socket.connected);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [room, setRoom] = useState(null);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  useEffect(() => {
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("room:update", setRoom);
    socket.on("chat:message", (m) => setMessages((prev) => [...prev, m]));
    return () => socket.off();
  }, []);

  const enter = (event, payload) =>
    socket.emit(event, payload, (res) => {
      if (res.ok) {
        setRoom(res.room);
        setError("");
      } else {
        setError(res.error);
      }
    });

  const joinCode = new URLSearchParams(window.location.search).get("sala") || "";

  if (!room) {
    return (
      <main>
        <h1>🕵️ Misterio</h1>
        <p>{connected ? "🟢 Conectado" : "🔴 Sin conexión al servidor"}</p>
        <input placeholder="Tu nombre" value={name} onChange={(e) => setName(e.target.value)} />
        {joinCode ? (
          <button disabled={!name || !connected} onClick={() => enter("room:join", { code: joinCode, name })}>
            Unirme a la sala {joinCode}
          </button>
        ) : (
          <>
            <button disabled={!name || !connected} onClick={() => enter("room:create", { name })}>
              Crear sala (soy el host)
            </button>
            <div className="row">
              <input placeholder="Código" value={code} maxLength={4} onChange={(e) => setCode(e.target.value.toUpperCase())} />
              <button style={{ width: "auto" }} disabled={!name || code.length !== 4} onClick={() => enter("room:join", { code, name })}>
                Unirse
              </button>
            </div>
          </>
        )}
        {error && <p className="err">{error}</p>}
      </main>
    );
  }

  const isHost = room.hostId === socket.id;
  const inviteUrl = `${window.location.origin}${window.location.pathname}?sala=${room.code}`;

  return (
    <main>
      <h1>Sala {room.code}</h1>
      {isHost && (
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span>Escanea para unirte:</span>
          <div className="qr"><QRCodeSVG value={inviteUrl} size={180} /></div>
          <small style={{ wordBreak: "break-all" }}>{inviteUrl}</small>
        </div>
      )}
      <div className="card">
        <h3>Jugadores ({room.players.length})</h3>
        <ul>
          {room.players.map((p) => (
            <li key={p.id}>{p.name} {p.id === room.hostId && "👑"} {p.id === socket.id && "(tú)"}</li>
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
            socket.emit("chat:send", { text });
            setText("");
          }
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Mensaje" />
        <button style={{ width: "auto" }}>Enviar</button>
      </form>
    </main>
  );
}
