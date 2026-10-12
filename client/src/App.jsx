import { useEffect, useState } from "react";
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
    const on = (e, fn) => socket.on(e, fn);
    on("connect", () => setConnected(true));
    on("disconnect", () => setConnected(false));
    on("room:update", setRoom);
    on("chat:message", (m) => setMessages((prev) => [...prev, m]));
    return () => socket.off();
  }, []);

  const enter = (event, payload) =>
    socket.emit(event, payload, (res) => (res.ok ? (setRoom(res.room), setError("")) : setError(res.error)));

  if (!room) {
    return (
      <main style={{ fontFamily: "sans-serif", maxWidth: 360, margin: "40px auto" }}>
        <h1>🕵️ Misterio</h1>
        <p>{connected ? "🟢 Conectado" : "🔴 Sin conexión al servidor"}</p>
        <input placeholder="Tu nombre" value={name} onChange={(e) => setName(e.target.value)} />
        <div style={{ marginTop: 12 }}>
          <button disabled={!name} onClick={() => enter("room:create", { name })}>Crear sala</button>
        </div>
        <div style={{ marginTop: 12 }}>
          <input placeholder="Código" value={code} maxLength={4} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          <button disabled={!name || code.length !== 4} onClick={() => enter("room:join", { code, name })}>Unirse</button>
        </div>
        {error && <p style={{ color: "crimson" }}>{error}</p>}
      </main>
    );
  }

  return (
    <main style={{ fontFamily: "sans-serif", maxWidth: 480, margin: "40px auto" }}>
      <h1>Sala {room.code}</h1>
      <h3>Jugadores ({room.players.length})</h3>
      <ul>
        {room.players.map((p) => (
          <li key={p.id}>{p.name} {p.id === room.hostId && "👑"} {p.id === socket.id && "(tú)"}</li>
        ))}
      </ul>
      <h3>Chat de prueba</h3>
      <div style={{ border: "1px solid #ccc", minHeight: 80, padding: 8 }}>
        {messages.map((m, i) => <div key={i}><b>{m.from}:</b> {m.text}</div>)}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); if (text) { socket.emit("chat:send", { text }); setText(""); } }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Mensaje" />
        <button>Enviar</button>
      </form>
    </main>
  );
}
