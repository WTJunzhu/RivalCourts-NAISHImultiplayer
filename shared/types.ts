export type CardType='Wasteland'|'Farmland'|'Strategist'|'Lord'|'Cavalry'|'Banner'|'Pass'|'City'|'Wanderer';
export type Nation='秦'|'齐'|'楚'|'赵'|'魏'|'韩'|'燕';
export type HistoryCardType='Alliance'|'BreakAlliance'|'WeiRescue'|'Apology'|'FarClose'|'Diplomat'|'Spy'|'Horsemanry';
export type GamePhase='WAITING'|'PASSING'|'PLAYING'|'SCORING'|'ENDED';
export type TurnSubPhase='TURN_START'|'ACTION_PENDING'|'PROMPT_PENDING'|'WAR_CHECK'|'TURN_END';
export type Zone='mingTang'|'anShi';
export type HiddenCard={type:'HIDDEN'};
export interface Card{ id:string; type:CardType }
export interface HistoryCard{ id:string; type:HistoryCardType; used:boolean }
export interface PlayerState{ id:string; name:string; mingTang:Card[]; anShi:Card[]; historyCards:HistoryCard[]; nation:Nation|null; nationDeclared:boolean; freeEnvoys:number; hasExtraEnvoy:boolean; commandEnvoyRecallable:boolean; warBonus:number; compensationBonus:number; warPenalties:number; peekCounts:Record<string,number>; passingSelection?:{anShiIdx:number; historyIdx?:number}; slotsUsed:SlotUsage; warsParticipated:number; hasPeekedThisTurn:boolean; turnsTaken:number }
export interface SlotUsage{ swap:number; discard:number; envoy:number; command:number }
export interface EnvoyInFlight{ id:string; fromPlayerId:string; toPlayerId:string; turnsLeft:number }
export interface TalentStack{ col:number; cards:Card[] }
export interface GameOptions{ historyCards:boolean; diplomacy:boolean; nationAbilities:boolean }
export interface GameLogEntry{ id:string; text:string; at:number; privateFor?:string }
export type PendingPrompt={type:'PEEK_REVEAL'; targetPlayerId:string; revealCount:number}
export interface GameState{ id:string; roomCode:string; phase:GamePhase; turnSubPhase:TurnSubPhase; options:GameOptions; gridSize:5|7|9; players:PlayerState[]; turnOrder:string[]; currentPlayerIndex:number; roundNumber:number; talent:TalentStack[]; slots:SlotUsage; envoysInFlight:EnvoyInFlight[]; claimedNations:Nation[]; stacksExhausted:number; warsThisRound:number; allianceMap:Record<string,{targetId:string; untilRound:number}>; pendingPrompt:PendingPrompt|null; discardTop:Card|null; log:GameLogEntry[]; ending?:{type:'HEGEMONY'|'FORCED'; triggerPlayerId:string; remainingTurns:string[]}; winnerIds?:string[]; scores?:Record<string,number> }
export type PlayerView=Omit<PlayerState,'anShi'|'historyCards'> & { anShi:(Card|HiddenCard)[]; historyCards:(HistoryCard|HiddenCard)[] };
export type GameView=Omit<GameState,'players'> & { players:PlayerView[]; myPlayerId:string };
export type RecruitAction={type:'RECRUIT'; targetZone:Zone; targetCol:number; swap?:{talentColA:number; talentColB:number}; discard?:{talentColA:number; talentColB:number}};
export type ActionPayload=RecruitAction|{type:'ENVOY'; targetPlayerId:string}|{type:'COMMAND'; myZone:Zone; myCol:number; targetPlayerId:string}|{type:'RECALL'}|{type:'DECLARE_NATION'; nation:Nation}|{type:'HEGEMONY'}|{type:'HISTORY_CARD'; cardType:HistoryCardType; params:Record<string,unknown>}|{type:'PEEK'; targetPlayerId:string; anShiCol:number}|{type:'PEEK_REVEAL'; anShiCols:number[]};
export type ClientMessage={type:'CREATE_ROOM'|'JOIN_ROOM'|'START_GAME'|'SUBMIT_PASS'|'ACTION'; payload:any};
export type ServerMessage={type:'ROOM_INFO'|'GAME_VIEW'|'ACTION_RESULT'|'PRIVATE_INFO'|'GAME_EVENT'|'ERROR'; payload:any};
