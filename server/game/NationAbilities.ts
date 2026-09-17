import type { GameState, Nation, PlayerState, Zone } from '../../shared/types.js';
import { centerCol, isAdjacent } from '../../shared/utils.js';

function allCards(player:PlayerState){ return [...player.mingTang.map((card,i)=>({card,zone:'mingTang' as Zone,col:i+1})),...player.anShi.map((card,i)=>({card,zone:'anShi' as Zone,col:i+1}))]; }
export function canDeclareNation(state:GameState,player:PlayerState,nation:Nation):boolean{
  if(state.claimedNations.includes(nation)) return false;
  if(player.mingTang[centerCol(state.gridSize)-1]?.type!=='Lord') return false;
  if(!state.options.nationAbilities) return true;
  const cards=allCards(player);
  if(nation==='秦') return player.slotsUsed.command>0&&player.freeEnvoys===0;
  if(nation==='齐') return new Set(cards.map(n=>n.card.type)).size>=7;
  if(nation==='楚') return cards.filter(n=>n.card.type==='Farmland').length>=4;
  if(nation==='赵') return player.anShi.filter((c,i)=>c.type==='Cavalry'&&player.mingTang[i]?.type==='Banner').length>=2;
  if(nation==='魏') return player.warsParticipated>=2;
  if(nation==='韩'){
    const passes=cards.filter(n=>n.card.type==='Pass');
    return passes.length>=3&&passes.every(p=>cards.some(o=>o!==p&&(o.card.type==='Pass'||['Strategist','Lord','Cavalry','Wanderer'].includes(o.card.type))&&isAdjacent(p.zone,p.col,o.zone,o.col)));
  }
  if(nation==='燕') return player.anShi.some(c=>c.type==='Wanderer')&&new Set(player.anShi.map(c=>c.type).filter(t=>t!=='Wasteland')).size>=4;
  return false;
}
export function applyNationAbility(state:GameState,player:PlayerState,nation:Nation):void{
  player.nation=nation; player.nationDeclared=true; state.claimedNations.push(nation);
  if(!state.options.nationAbilities) return;
  if(nation==='秦'){ player.commandEnvoyRecallable=true; const ownCmds=player.slotsUsed.command; player.freeEnvoys+=ownCmds; state.slots.command-=ownCmds; player.slotsUsed.command=0; }
  if(nation==='魏'){ player.hasExtraEnvoy=true; player.freeEnvoys+=1; }
}
export function isLockedCenter(player:PlayerState,zone:Zone,col:number,gridSize:number){ return player.nationDeclared&&zone==='mingTang'&&col===centerCol(gridSize); }
