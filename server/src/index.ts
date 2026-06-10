import http from 'http';
import express from 'express';
import cors from 'cors';
import colyseus from 'colyseus';
const { Server } = colyseus;
import { WebSocketTransport } from '@colyseus/ws-transport';
import { TdmRoom } from './rooms/TdmRoom.js';
import { ZombieRoom } from './rooms/ZombieRoom.js';

const PORT = Number(process.env.PORT) || 2567;

const app = express();
app.use(cors());
app.get('/health', (_req, res) => res.json({ ok: true, name: '5mGun', ts: Date.now() }));

const httpServer = http.createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define('tdm', TdmRoom);
gameServer.define('zombie', ZombieRoom);

httpServer.listen(PORT, () => {
  console.log(`🔫 5mGun server listening on ws://localhost:${PORT}`);
});
