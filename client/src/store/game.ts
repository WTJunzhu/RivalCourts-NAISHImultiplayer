import { defineStore } from 'pinia';
import type { ActionPayload, GameOptions, GameView } from '../../../shared/types';
import { GameSocket } from '../ws/client';

export const useGameStore=defineStore('game',{
  state:()=>({
    socket:null as GameSocket|null,
    status:'idle',
    room:null as any,
    view:null as GameView|null,
    error:'',
    lastResult:'',
    _playerName:'',
  }),
  getters:{
    me(state){ return state.view?.players.find(p=>p.id===state.view?.myPlayerId); },
    currentPlayer(state){ return state.view?.players.find(p=>p.id===state.view?.turnOrder[state.view?.currentPlayerIndex??0]); },
    isMyTurn():boolean{ return !!this.view&&this.view.phase==='PLAYING'&&this.currentPlayer?.id===this.view.myPlayerId; },
  },
  actions:{
    ensure(){
      if(this.socket) return;
      this.socket=new GameSocket((type,payload:any)=>{
        if(type==='ROOM_INFO'){
          this.room=payload;
          if(payload.code&&this._playerName) this.socket?.setJoinParams(payload.code,this._playerName);
        }
        if(type==='GAME_VIEW') this.view=payload;
        if(type==='ACTION_RESULT'){ this.lastResult=payload.success?'行动成功':payload.error; if(!payload.success) this.error=payload.error; }
        if(type==='ERROR') this.error=payload.message;
      },s=>this.status=s);
      this.socket.connect();
    },
    createRoom(name:string,options:GameOptions){ this.ensure(); this._playerName=name; this.socket!.createRoom(name,options); },
    joinRoom(code:string,name:string){ this.ensure(); this._playerName=name; this.socket!.joinRoom(code,name); },
    startGame(){ this.socket?.startGame(); },
    submitPass(a:number,h?:number){ this.socket?.submitPass(a,h); },
    action(action:ActionPayload){ this.socket?.action(action); },
  },
});
