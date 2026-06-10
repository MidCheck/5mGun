import { Client, Room } from 'colyseus.js';

export function makeClient(): Client {
  // 开发：连本地服务器；生产可换为 wss://your-domain
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const host = location.hostname;
  const port = 2567;
  return new Client(`${proto}://${host}:${port}`);
}

export interface JoinResult { room: Room; sessionId: string; }

export async function quickStart(client: Client, mode: string, opts: any): Promise<JoinResult> {
  const room = await client.create(mode, opts);
  return { room, sessionId: room.sessionId };
}

export async function createRoom(client: Client, mode: string, opts: any): Promise<JoinResult> {
  const room = await client.create(mode, opts);
  return { room, sessionId: room.sessionId };
}

export async function joinByCode(client: Client, code: string, opts: any): Promise<JoinResult> {
  const room = await client.joinById(code, opts);
  return { room, sessionId: room.sessionId };
}
