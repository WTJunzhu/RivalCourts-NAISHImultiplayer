import type { WebSocket } from 'ws';
import type { ActionPayload, ClientMessage, GameOptions, GameState, ServerMessage } from '../../shared/types.js';
import { uid } from '../../shared/utils.js';
import { applyAction, createInitialState, submitPass } from '../game/GameEngine.js';
import { loadAllRooms, loadSnapshot, saveRoom, saveSnapshot } from '../db/queries.js';
import { projectForPlayer } from './ViewProjector.js';

type Client={socket:WebSocket; playerId:string; roomCode:string};
type Room={code:string; hostId:string; players:{id:string;name:string}[]; options:GameOptions; game?:GameState; clients:Map<string,WebSocket>};

const rooms=new Map<string,Room>();
function genCode():string{ let c=Math.random().toString(36).slice(2,7).toUpperCase(); return rooms.has(c)?genCode():c; }
function send(socket:WebSocket,type:ServerMessage['type'],payload:unknown){ socket.send(JSON.stringify({type,payload})); }
function roomInfo(room:Room,myPlayerId:string){ return {code:room.code,hostId:room.hostId,players:room.players,options:room.options,phase:room.game?.phase??'WAITING',myPlayerId}; }

export class RoomManager {
  private clients=new Map<WebSocket,Client>();

  async init(){
    const saved=await loadAllRooms();
    for(const r of saved){
      const room:Room={code:r.code,hostId:r.hostId,players:r.players,options:r.options,clients:new Map()};
      const snap=await loadSnapshot(r.code);
      if(snap) room.game=snap;
      rooms.set(r.code,room);
    }
    console.log(`[RoomManager] restored ${rooms.size} room(s) from DB`);
  }

  handle(socket:WebSocket,raw:Buffer){
    let message:ClientMessage;
    try{ message=JSON.parse(raw.toString()); }catch{ send(socket,'ERROR',{message:'消息不是合法 JSON'}); return; }
    const dispatch=async()=>{
      if(message.type==='CREATE_ROOM') await this.createRoom(socket,message.payload);
      else if(message.type==='JOIN_ROOM') await this.joinRoom(socket,message.payload);
      else if(message.type==='START_GAME') await this.startGame(socket);
      else if(message.type==='SUBMIT_PASS') await this.pass(socket,message.payload);
      else if(message.type==='ACTION') await this.action(socket,message.payload.action);
    };
    dispatch().catch(err=>send(socket,'ACTION_RESULT',{success:false,error:err instanceof Error?err.message:String(err)}));
  }

  disconnect(socket:WebSocket){ this.clients.delete(socket); }

  private async createRoom(socket:WebSocket,payload:{playerName:string;options:GameOptions}){
    const roomCode=genCode();
    const player={id:uid('player'),name:payload.playerName||'无名士'};
    const room:Room={code:roomCode,hostId:player.id,players:[player],options:payload.options,clients:new Map([[player.id,socket]])};
    rooms.set(roomCode,room);
    this.clients.set(socket,{socket,playerId:player.id,roomCode});
    saveRoom(roomCode,player.id,payload.options,[player]).catch(console.error);
    send(socket,'ROOM_INFO',roomInfo(room,player.id));
  }

  private async joinRoom(socket:WebSocket,payload:{roomCode:string;playerName:string}){
    const room=rooms.get(payload.roomCode?.toUpperCase());
    if(!room) throw new Error('房间不存在');

    if(room.game){
      // Reconnect: match by name
      const existing=room.players.find(p=>p.name===payload.playerName);
      if(!existing) throw new Error('游戏已开始，请以原名号重新加入');
      room.clients.set(existing.id,socket);
      this.clients.set(socket,{socket,playerId:existing.id,roomCode:room.code});
      send(socket,'ROOM_INFO',roomInfo(room,existing.id));
      send(socket,'GAME_VIEW',projectForPlayer(room.game,existing.id));
      return;
    }

    if(room.players.length>=7) throw new Error('房间已满');
    const player={id:uid('player'),name:payload.playerName||'无名士'};
    room.players.push(player);
    room.clients.set(player.id,socket);
    this.clients.set(socket,{socket,playerId:player.id,roomCode:room.code});
    saveRoom(room.code,room.hostId,room.options,room.players).catch(console.error);
    this.broadcastRoom(room);
    send(socket,'ROOM_INFO',roomInfo(room,player.id));
  }

  private async startGame(socket:WebSocket){
    const room=this.getRoom(socket);
    const client=this.clients.get(socket)!;
    if(room.hostId!==client.playerId) throw new Error('只有房主可以开始');
    if(room.players.length<2) throw new Error('至少需要两名玩家');
    room.game=createInitialState(room.code,room.players,room.options);
    this.broadcastRoom(room);
    this.broadcastViews(room);
    saveSnapshot(room.code,room.game).catch(console.error);
  }

  private async pass(socket:WebSocket,payload:{anShiCardIndex:number;historyCardIndex?:number}){
    const room=this.getRoom(socket);
    const client=this.clients.get(socket)!;
    if(!room.game) throw new Error('游戏尚未开始');
    submitPass(room.game,client.playerId,payload.anShiCardIndex,payload.historyCardIndex);
    this.broadcastViews(room);
    saveSnapshot(room.code,room.game).catch(console.error);
  }

  private async action(socket:WebSocket,action:ActionPayload){
    const room=this.getRoom(socket);
    const client=this.clients.get(socket)!;
    if(!room.game) throw new Error('游戏尚未开始');
    applyAction(room.game,client.playerId,action);
    send(socket,'ACTION_RESULT',{success:true});
    this.broadcastViews(room);
    saveSnapshot(room.code,room.game).catch(console.error);
  }

  private getRoom(socket:WebSocket){
    const client=this.clients.get(socket);
    if(!client) throw new Error('尚未加入房间');
    const room=rooms.get(client.roomCode);
    if(!room) throw new Error('房间不存在');
    return room;
  }

  private broadcastRoom(room:Room){ for(const [pid,s] of room.clients) send(s,'ROOM_INFO',roomInfo(room,pid)); }
  private broadcastViews(room:Room){ if(!room.game) return; for(const [pid,s] of room.clients) send(s,'GAME_VIEW',projectForPlayer(room.game,pid)); }
}
