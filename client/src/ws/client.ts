import type { ActionPayload, ClientMessage, GameOptions } from '../../../shared/types';

export class GameSocket {
  private ws:WebSocket|null=null;
  constructor(private onMessage:(type:string,payload:any)=>void, private onStatus:(status:string)=>void){}
  connect(){
    const protocol=location.protocol==='https:'?'wss':'ws';
    const host=location.hostname;
    const url=(import.meta.env.VITE_WS_URL as string|undefined) ?? `${protocol}://${host}:8787/ws`;
    this.ws=new WebSocket(url);
    this.ws.onopen=()=>this.onStatus('connected');
    this.ws.onclose=()=>this.onStatus('closed');
    this.ws.onerror=()=>this.onStatus('error');
    this.ws.onmessage=event=>{ const msg=JSON.parse(event.data); this.onMessage(msg.type,msg.payload); };
  }
  send(type:ClientMessage['type'],payload:any){ this.ws?.send(JSON.stringify({type,payload})); }
  createRoom(playerName:string,options:GameOptions){ this.send('CREATE_ROOM',{playerName,options}); }
  joinRoom(roomCode:string,playerName:string){ this.send('JOIN_ROOM',{roomCode,playerName}); }
  startGame(){ this.send('START_GAME',{}); }
  submitPass(anShiCardIndex:number,historyCardIndex?:number){ this.send('SUBMIT_PASS',{anShiCardIndex,historyCardIndex}); }
  action(action:ActionPayload){ this.send('ACTION',{action}); }
}
