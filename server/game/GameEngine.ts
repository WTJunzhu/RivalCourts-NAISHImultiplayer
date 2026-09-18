import { BOARD_SPECS, SLOT_LIMITS } from '../../shared/constants.js';
import type { ActionPayload, GameOptions, GameState, PlayerState, Zone } from '../../shared/types.js';
import { centerCol, currentPlayer, markExhausted, mirrorCol, normalizeCol, uid } from '../../shared/utils.js';
import { createHistoryCards, createTalentStacks, randomStartingCard, wasteland } from './CardPool.js';
import { applyNationAbility, canDeclareNation, isLockedCenter } from './NationAbilities.js';
import { scoreGame, scorePlayer } from './ScoreEngine.js';

const defaultOptions:GameOptions={historyCards:true,diplomacy:false,nationAbilities:true};
function log(state:GameState,text:string,privateFor?:string){ state.log.unshift({id:uid('log'),text,at:Date.now(),privateFor}); state.log=state.log.slice(0,80); }
function cardAt(player:PlayerState,zone:Zone,col:number){ return player[zone][col-1]; }
function setCard(player:PlayerState,zone:Zone,col:number,card:any){ player[zone][col-1]=card; }
function requireTurn(state:GameState,playerId:string){ if(state.phase!=='PLAYING') throw new Error('现在不能行动'); if(currentPlayer(state).id!==playerId) throw new Error('还没轮到你'); if(state.pendingPrompt!==null) throw new Error('请先完成偷看展示再行动'); }
function spendEnvoy(player:PlayerState){ if(player.freeEnvoys<=0) throw new Error('没有可用使节'); player.freeEnvoys--; }
function advanceTurn(state:GameState){
  if(state.phase!=='PLAYING') return;
  const acted=currentPlayer(state); acted.turnsTaken++;
  for(const envoy of state.envoysInFlight) envoy.turnsLeft--;
  const due=state.envoysInFlight.filter(e=>e.turnsLeft<=0); state.envoysInFlight=state.envoysInFlight.filter(e=>e.turnsLeft>0);
  for(const e of due) resolveWar(state,e.fromPlayerId,e.toPlayerId);
  markExhausted(state);
  if(!state.ending&&state.stacksExhausted>=BOARD_SPECS[state.players.length as keyof typeof BOARD_SPECS].forced){
    const minTurns=Math.min(...state.players.map(p=>p.turnsTaken));
    state.ending={type:'FORCED',triggerPlayerId:acted.id,remainingTurns:state.turnOrder.filter(id=>(state.players.find(p=>p.id===id)?.turnsTaken??0)===minTurns)};
    if(state.ending.remainingTurns.length===0) finishGame(state);
  }
  if(state.ending){ state.ending.remainingTurns=state.ending.remainingTurns.filter(id=>id!==acted.id); if(state.ending.remainingTurns.length===0){ finishGame(state); return; } }
  state.currentPlayerIndex=(state.currentPlayerIndex+1)%state.turnOrder.length;
  if(state.currentPlayerIndex===0){ state.roundNumber++; state.warsThisRound=0; }
  currentPlayer(state).hasPeekedThisTurn=false;
}
function finishGame(state:GameState){ state.phase='ENDED'; state.turnSubPhase='TURN_END'; state.scores=scoreGame(state.players,state.gridSize); const max=Math.max(...Object.values(state.scores)); state.winnerIds=Object.entries(state.scores).filter(([,s])=>s===max).map(([id])=>id); log(state,`游戏结束，胜者：${state.winnerIds.map(id=>state.players.find(p=>p.id===id)?.name).join('、')}`); }
function resolveWar(state:GameState,fromId:string,toId:string){ const a=state.players.find(p=>p.id===fromId)!; const b=state.players.find(p=>p.id===toId)!; const sa=scorePlayer(a,state.gridSize); const sb=scorePlayer(b,state.gridSize); if(sa>=sb){ a.warBonus+=5; b.warBonus-=5; log(state,`${a.name} 对 ${b.name} 的开战结算：${a.name} 胜`); } else { b.warBonus+=5; a.warBonus-=5; log(state,`${a.name} 对 ${b.name} 的开战结算：${b.name} 胜`); } a.warsParticipated++; b.warsParticipated++; state.warsThisRound++; }
export function createInitialState(roomCode:string,players:{id:string;name:string}[],options:Partial<GameOptions>={}):GameState{
  const spec=BOARD_SPECS[players.length as keyof typeof BOARD_SPECS]; if(!spec) throw new Error('需要 2–7 名玩家');
  const gameOptions={...defaultOptions,...options};
  const state:GameState={id:uid('game'),roomCode,phase:'PASSING',turnSubPhase:'ACTION_PENDING',options:gameOptions,gridSize:spec.gridSize,players:[],turnOrder:players.map(p=>p.id),currentPlayerIndex:0,roundNumber:1,talent:createTalentStacks(players.length,spec.gridSize),slots:{swap:0,discard:0,envoy:0,command:0},envoysInFlight:[],claimedNations:[],stacksExhausted:0,warsThisRound:0,allianceMap:{},pendingPrompt:null,discardTop:null,log:[]};
  state.players=players.map(p=>{ const mingTang=Array.from({length:spec.gridSize},(_,i)=>wasteland(i+1)); const anShi=Array.from({length:spec.gridSize},(_,i)=>wasteland(i+1)); const spots=[...Array(spec.gridSize).keys()].sort(()=>Math.random()-0.5).slice(0,2); for(const spot of spots) anShi[spot]=randomStartingCard(); return {id:p.id,name:p.name,mingTang,anShi,historyCards:createHistoryCards(gameOptions.historyCards),nation:null,nationDeclared:false,freeEnvoys:3,hasExtraEnvoy:false,commandEnvoyRecallable:false,warBonus:0,compensationBonus:0,warPenalties:0,peekCounts:{},slotsUsed:{swap:0,discard:0,envoy:0,command:0},warsParticipated:0,hasPeekedThisTurn:false,turnsTaken:0}; });
  log(state,'开局发牌完成，请选择传牌'); return state;
}
export function submitPass(state:GameState,playerId:string,anShiIdx:number,historyIdx?:number){ if(state.phase!=='PASSING') throw new Error('当前不是传牌阶段'); const p=state.players.find(x=>x.id===playerId)!; if(anShiIdx<0||anShiIdx>=state.gridSize) throw new Error('暗室选择无效'); if(state.options.historyCards&&(historyIdx===undefined||!p.historyCards[historyIdx])) throw new Error('史书卡选择无效'); p.passingSelection={anShiIdx,historyIdx}; if(state.players.every(x=>x.passingSelection)){ const passed=state.players.map(p=>({card:p.anShi[p.passingSelection!.anShiIdx],history:state.options.historyCards?p.historyCards[p.passingSelection!.historyIdx!]:undefined,slot:p.passingSelection!.anShiIdx})); state.players.forEach((p,i)=>{ const from=(i-1+state.players.length)%state.players.length; p.anShi[p.passingSelection!.anShiIdx]=passed[from].card; if(state.options.historyCards&&passed[from].history){ p.historyCards=p.historyCards.filter((_,idx)=>idx!==p.passingSelection!.historyIdx); p.historyCards.push(passed[from].history); } delete p.passingSelection; }); state.phase='PLAYING'; log(state,'传牌完成，游戏开始'); } }
export function applyAction(state:GameState,playerId:string,action:ActionPayload){ requireTurn(state,playerId); const player=currentPlayer(state); const limits=SLOT_LIMITS[state.gridSize];
  if(action.type==='RECRUIT'){
    normalizeCol(action.targetCol,state.gridSize); if(isLockedCenter(player,action.targetZone,action.targetCol,state.gridSize)) throw new Error('宣国后的君主位已锁定'); const stack=state.talent[action.targetCol-1]; const card=stack.cards.shift(); if(!card) throw new Error('该列无英才可招，请先交换英才叠'); const old=cardAt(player,action.targetZone,action.targetCol); setCard(player,action.targetZone,action.targetCol,card); state.discardTop=old; log(state,`${player.name} 招贤 ${card.type}，替换 ${old.type}`);
    if(action.swap){ if(state.slots.swap>=limits.swap) throw new Error('交换槽已满'); spendEnvoy(player); state.slots.swap++; player.slotsUsed.swap++; const {talentColA,talentColB}=action.swap; normalizeCol(talentColA,state.gridSize); normalizeCol(talentColB,state.gridSize); if(talentColA===talentColB) throw new Error('不能与自身交换'); const stA=state.talent[talentColA-1],stB=state.talent[talentColB-1]; if(stA.cards.length===0&&stB.cards.length===0) throw new Error('两叠均为空，无法交换'); if(stA.cards.length===0||stB.cards.length===0){ const tmp=stA.cards; stA.cards=stB.cards; stB.cards=tmp; log(state,`${player.name} 附加整叠移位`); } else { const top=stA.cards[0]; stA.cards[0]=stB.cards[0]; stB.cards[0]=top; log(state,`${player.name} 附加交换英才叠 ${talentColA}↔${talentColB} 顶牌`); } }
    if(action.discard){ if(state.slots.discard>=limits.discard) throw new Error('弃牌槽已满'); spendEnvoy(player); state.slots.discard++; player.slotsUsed.discard++; for(const col of [action.discard.talentColA,action.discard.talentColB]){ normalizeCol(col,state.gridSize); const dc=state.talent[col-1].cards.shift(); if(dc) state.discardTop=dc; } log(state,`${player.name} 附加弃牌`); }
  } else if(action.type==='RECALL') { const own=player.slotsUsed; const reclaim=own.swap+own.discard+own.envoy+(player.commandEnvoyRecallable?own.command:0); player.freeEnvoys+=reclaim; state.slots.swap-=own.swap; state.slots.discard-=own.discard; state.slots.envoy-=own.envoy; if(player.commandEnvoyRecallable){ state.slots.command-=own.command; own.command=0; } own.swap=0; own.discard=0; own.envoy=0; log(state,`${player.name} 召回可召回使节`);
  } else if(action.type==='DECLARE_NATION') { if(!canDeclareNation(state,player,action.nation)) { log(state,`${player.name} 宣国 ${action.nation} 失败`); } else { applyNationAbility(state,player,action.nation); log(state,`${player.name} 宣国 ${action.nation}`); }
  } else if(action.type==='COMMAND') { if(!player.nationDeclared) throw new Error('宣国后才能号令'); if(state.slots.command>=limits.command) throw new Error('号令槽已满'); normalizeCol(action.myCol,state.gridSize); if(isLockedCenter(player,action.myZone,action.myCol,state.gridSize)) throw new Error('不能移动锁定君主位'); const target=state.players.find(p=>p.id===action.targetPlayerId); if(!target) throw new Error('目标玩家不存在'); const targetCol=mirrorCol(action.myCol,state.gridSize); const targetCard=cardAt(target,action.myZone,targetCol); if(targetCard.type==='Lord') throw new Error('该格位存在君主牌，请重新选择'); if(target.nationDeclared&&target.nation==='韩'&&targetCard.type==='Pass') throw new Error('韩国关隘不可被号令'); spendEnvoy(player); state.slots.command++; player.slotsUsed.command++; const mine=cardAt(player,action.myZone,action.myCol); setCard(player,action.myZone,action.myCol,targetCard); setCard(target,action.myZone,targetCol,mine); log(state,`${player.name} 对 ${target.name} 发动号令`);
  } else if(action.type==='HEGEMONY') { if(!player.nationDeclared) throw new Error('宣国后才能称霸'); markExhausted(state); const spec=BOARD_SPECS[state.players.length as keyof typeof BOARD_SPECS]; if(state.stacksExhausted<spec.hegemony) throw new Error('尚未达到称霸门槛'); state.ending={type:'HEGEMONY',triggerPlayerId:player.id,remainingTurns:state.turnOrder.filter(id=>id!==player.id)}; log(state,`${player.name} 宣告称霸，其余玩家各补一轮`);
  } else if(action.type==='ENVOY') { if(!state.options.diplomacy) throw new Error('本局未开启出使/开战'); if(state.slots.envoy>=limits.envoy) throw new Error('出使槽已满'); const target=state.players.find(p=>p.id===action.targetPlayerId); if(!target||target.id===player.id) throw new Error('目标玩家无效'); spendEnvoy(player); state.slots.envoy++; player.slotsUsed.envoy++; const a=state.turnOrder.indexOf(player.id),b=state.turnOrder.indexOf(target.id); const d=Math.abs(a-b); state.envoysInFlight.push({id:uid('envoy'),fromPlayerId:player.id,toPlayerId:target.id,turnsLeft:Math.min(d,state.players.length-d)}); log(state,`${player.name} 向 ${target.name} 出使`);
  } else if(action.type==='PEEK') {
    if(state.phase!=='PLAYING') throw new Error('现在不能行动');
    if(currentPlayer(state).id!==playerId) throw new Error('还没轮到你');
    if(player.nation!=='齐'||!player.nationDeclared) throw new Error('只有宣认齐国后才能偷看');
    if(player.hasPeekedThisTurn) throw new Error('本回合已偷看过');
    if(state.pendingPrompt!==null) throw new Error('请先完成偷看展示');
    const peekTarget=state.players.find(p=>p.id===action.targetPlayerId);
    if(!peekTarget||peekTarget.id===player.id) throw new Error('目标玩家无效');
    normalizeCol(action.anShiCol,state.gridSize);
    const peeked=peekTarget.anShi[action.anShiCol-1];
    player.peekCounts[action.targetPlayerId]=(player.peekCounts[action.targetPlayerId]??0)+1;
    const peekNum=player.peekCounts[action.targetPlayerId];
    log(state,`${player.name} 偷看了 ${peekTarget.name} 暗室第 ${action.anShiCol} 列：${peeked.type}`,player.id);
    player.hasPeekedThisTurn=true;
    if(peekNum%2===0){ state.pendingPrompt={type:'PEEK_REVEAL',targetPlayerId:action.targetPlayerId,revealCount:1}; log(state,`${player.name} 已第 ${peekNum} 次偷看 ${peekTarget.name}，需展示自己 1 张暗室牌`); }
  } else if(action.type==='PEEK_REVEAL') {
    if(state.phase!=='PLAYING') throw new Error('现在不能行动');
    if(currentPlayer(state).id!==playerId) throw new Error('还没轮到你');
    const prompt=state.pendingPrompt;
    if(prompt===null||prompt.type!=='PEEK_REVEAL') throw new Error('当前没有待展示的偷看');
    if(action.anShiCols.length!==prompt.revealCount) throw new Error(`需要展示 ${prompt.revealCount} 张暗室牌，收到 ${action.anShiCols.length} 张`);
    const revealTarget=state.players.find(p=>p.id===prompt.targetPlayerId)!;
    for(const col of action.anShiCols){ normalizeCol(col,state.gridSize); log(state,`${player.name} 向 ${revealTarget.name} 展示了暗室第 ${col} 列：${player.anShi[col-1].type}`,prompt.targetPlayerId); }
    state.pendingPrompt=null;
  } else { throw new Error('该 MVP 暂未实现史书卡行动'); }
  advanceTurn(state);
}
