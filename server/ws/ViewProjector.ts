import type { GameState, GameView, PlayerView } from '../../shared/types.js';

export function projectForPlayer(state:GameState,viewerId:string):GameView{
  return {
    ...state,
    myPlayerId:viewerId,
    log:state.log.filter(entry=>!entry.privateFor||entry.privateFor===viewerId),
    players:state.players.map((p):PlayerView=>{
      const visible=p.id===viewerId||p.nationDeclared||state.phase==='ENDED';
      return visible ? p : {...p,anShi:p.anShi.map(()=>({type:'HIDDEN' as const})),historyCards:p.historyCards.map(()=>({type:'HIDDEN' as const}))};
    }),
  };
}
