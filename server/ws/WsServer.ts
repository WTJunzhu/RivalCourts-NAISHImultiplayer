import { WebSocketServer } from 'ws';
import type { Server } from 'node:http';
import { RoomManager } from './RoomManager.js';

export function attachWsServer(server:Server){
  const wss=new WebSocketServer({server,path:'/ws'});
  const rooms=new RoomManager();
  wss.on('connection',socket=>{
    socket.on('message',raw=>rooms.handle(socket,raw as Buffer));
    socket.on('close',()=>rooms.disconnect(socket));
  });
  return rooms;
}
