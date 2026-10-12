import { io } from "socket.io-client";

// En LAN/producción el servidor está en el mismo host que sirve el cliente, puerto 3001.
const url = import.meta.env.VITE_SERVER_URL || `http://${window.location.hostname}:3001`;
export const socket = io(url, { autoConnect: true });
