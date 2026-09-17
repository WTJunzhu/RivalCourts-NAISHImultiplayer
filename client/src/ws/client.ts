import type { ActionPayload, ClientMessage, GameOptions } from '../../../shared/types';

export class GameSocket {
  private ws: WebSocket | null = null;
  private _joinParams: {roomCode:string; playerName:string} | null = null;
  private _reconnTimer: ReturnType<typeof setTimeout> | null = null;
  private _destroyed = false;

  constructor(
    private onMessage:(type:string,payload:unknown)=>void,
    private onStatus:(status:string)=>void
  ){}

  connect(){
    const protocol=location.protocol==='https:'?'wss':'ws';
    const host=location.hostname;
    const url=(import.meta.env.VITE_WS_URL as string|undefined)??`${protocol}://${host}:8787/ws`;
    this.ws=new WebSocket(url);
    this.ws.onopen=()=>{
      this.onStatus('connected');
      if(this._joinParams) this.send('JOIN_ROOM',this._joinParams);
    };
    this.ws.onclose=()=>{
      this.onStatus('disconnected');
      if(!this._destroyed&&this._joinParams){
        this._reconnTimer=setTimeout(()=>this.connect(),2000);
      }
    };
    this.ws.onerror=()=>this.onStatus('error');
    this.ws.onmessage=event=>{ const msg=JSON.parse(event.data as string); this.onMessage(msg.type,msg.payload); };
  }

  destroy(){
    this._destroyed=true;
    if(this._reconnTimer) clearTimeout(this._reconnTimer);
    this.ws?.close();
  }

  setJoinParams(roomCode:string,playerName:string){ this._joinParams={roomCode,playerName}; }

  send(type:ClientMessage['type'],payload:unknown){ this.ws?.send(JSON.stringify({type,payload})); }
  createRoom(playerName:string,options:GameOptions){ this.send('CREATE_ROOM',{playerName,options}); }
  joinRoom(roomCode:string,playerName:string){ this.setJoinParams(roomCode,playerName); this.send('JOIN_ROOM',{roomCode,playerName}); }
  startGame(){ this.send('START_GAME',{}); }
  submitPass(anShiCardIndex:number,historyCardIndex?:number){ this.send('SUBMIT_PASS',{anShiCardIndex,historyCardIndex}); }
  action(action:ActionPayload){ this.send('ACTION',{action}); }
}
