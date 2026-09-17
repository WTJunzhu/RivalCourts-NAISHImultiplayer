# 纵横（Rival Courts）技术建设计划

> 本文档面向接手开发的工程师或 AI，读完后应能理解项目全貌并立即上手。
> 游戏完整规则见 `README.md`（权威来源），快速查阅见 `NAISHI_QUICKREF.txt`。

---

## 一、项目概述

**纵横** 是一款战国七雄主题多人联机桌游，改编自法国桌游《内侍（Naishi）》（Merle Éditions 2024），支持 2–7 人实时在线对战。

核心玩法：所有玩家白板起手，在棋盘上招揽人才、积累势力，中期通过**宣国**获得国家专属能力，最终以最高分称霸。

**当前状态**：

| 工作 | 状态 |
|------|------|
| 游戏规则设计 | ✅ 完成（见 README.md） |
| TypeScript 类型草案 | ✅ 见 README 第十四章 |
| 代码实现 | ❌ 未开始 |

---

## 二、技术栈

| 层 | 技术 | 托管 | 备注 |
|----|------|------|------|
| 前端 | Vue 3 + TypeScript + Vite | Vercel | 静态构建，CDN 分发 |
| 后端 | Node.js + TypeScript + Express + `ws` | Render **付费层** | 免费层 15 min 不活跃会休眠，WebSocket 连接直接断开；付费层 $7/月 |
| 数据库 | Turso（libSQL / SQLite 兼容） | Turso | 存房间元数据 + 断线重连快照 |
| 共享 | TypeScript 类型 + 常量 | — | 前后端共用同一套定义 |

**核心原则：服务端权威**。所有游戏逻辑（合法性校验、状态转换、计分）只在服务端运行。客户端只渲染收到的视角数据，发送操作指令。

---

## 三、关键游戏规则速记

> 本节只列影响代码实现的关键规则。完整规则见 README.md。

### 3.1 棋盘结构

每位玩家独立拥有**明堂**（公开）和**暗室**（隐藏）两区，格数相同：

| 场次 | 人数 | 格数 | 君主位（中央） | 称霸门槛 | 强制结算上限 |
|------|------|------|--------------|--------|------------|
| 小局 | 2–3 人 | 5 格 | 第 3 格 | 耗尽 1 叠 | 耗尽 2 叠 |
| 中局 | 4–6 人 | 7 格 | 第 4 格 | 耗尽 2 叠 | 耗尽 3 叠 |
| 大局 | 7 人 | 9 格 | 第 5 格 | 耗尽 3 叠 | 耗尽 4 叠 |

**列国英才**：公共牌池，同格数，每格一叠，顶牌朝上。君主牌只在英才中出现。

### 3.2 镜像对称规则（重要，影响所有跨玩家换牌）

原版《内侍》设计：两个玩家相对而坐，位置编号从己方视角来看是镜像的。本游戏无论多少人均沿用此规则——每次需要跨玩家换牌时，把目标玩家想象成直接对面的对家。

```
mirrorCol(col, gridSize) = gridSize + 1 - col

5格: 1↔5, 2↔4, 3↔3（中心对称）
7格: 1↔7, 2↔6, 3↔5, 4↔4
9格: 1↔9, 2↔8, 3↔7, 4↔6, 5↔5
```

**适用场景**：号令、围魏救赵强制号令、一切涉及"拿自己的牌去和另一位玩家换"的机制。

> **与 README 的关系**：README 中号令描述写"同编号格位互换"，实际指的是经过镜像换算后的位置，代码实现应始终调用 `mirrorCol()`。

### 3.3 隐藏信息

- 暗室牌面只有本人可见（宣国后永久对所有人公开）
- 史书卡手牌只有本人可见
- 服务端发给客户端的状态**必须经过 ViewProjector 过滤**（见第五章），否则客户端可通过 DevTools 看到对手暗室

### 3.4 使节与槽位

每人固定 3 枚使节（魏国宣国后多 1 枚附加使节，限交换/弃牌用）。槽位是**全局共享**的，不是每人独立：

| 行动 | 性质 | 5格 | 7格 | 9格 |
|------|------|-----|-----|-----|
| 交换（附加） | 非永久 | 3 | 4 | 5 |
| 弃牌（附加） | 非永久 | 2 | 3 | 4 |
| 出使 | 非永久 | 2 | 3 | 4 |
| 号令 | **永久** | 1 | 2 | 3 |

号令槽使节永久不可召回（**秦国宣国后例外**：变为可召回，并立即全部召回）。

### 3.5 出使与战争（出使/开战模块，可选）

出使后 N 个玩家回合后触发战争（N = 两玩家在回合顺序上的最近距离）。结算时比较双方当前总分，公布胜负，不公布分数；胜 +5，败 −5。出使使节留在槽上等待召回。

### 3.6 宣国系统

满足三条件同时触发：①明堂中央有君主牌 ②满足该国专属激活条件（见 README 第九章）③该国尚未被他人宣认。

宣国后四件事同时发生：国家能力生效、君主牌分数归零、中央位永久锁定、暗室全公开。

### 3.7 游戏结束

- **称霸（主动，宣国后）**：英才耗尽叠数 ≥ 称霸门槛时可触发。触发后，**其余玩家无条件各补 1 轮**（即使轮数已对齐也补）。
- **强制结算（被动）**：英才耗尽叠数达强制上限时触发。若本轮还有玩家未行动，让其补完本轮后结算；若轮数已对齐则立即结算。

**术语**：`回合` = 单个玩家的一次行动；`轮数` = 全员各行动一次为一轮（史书卡等额外行动不计入轮数）。强制结算以轮数对齐为公平性判断依据。

### 3.8 史书卡要点（史书卡模块，可选）

- 宣国后才能打出，每张只用一次，替代常规行动使用（消耗本回合）
- **例外：连横破盟** 在自己回合时，若有使节在途或本轮发生过至少一次战争，则可打出（不是实时响应机制，在自己回合判断）
- **例外：齐国偷看** 在自己回合开始时触发，可选择性执行（不强制）

### 3.9 七国能力要点

所有能力在宣国时生效，详见 README 第九章。代码实现需注意：

| 国家 | 实现关键点 |
|------|-----------|
| 秦 | 宣国时将号令槽使节全部变为可召回并立即召回；此后号令使节非永久 |
| 齐 | 在 PlayerState 维护 `peekCounts: Map<playerId, number>`，每偷看目标 2/4/6 次时强制展示己方暗室 1/2/3 张 |
| 楚 | 农田计分时解锁第四档：≥5 张连通 → +40 分 |
| 赵 | 所有骑兵得分翻倍（+3→+6，+10→+20，不只是有旌旗的情况） |
| 魏 | 宣国时立即给予 1 枚附加使节（可召回，但只能用于交换/弃牌附加行动） |
| 韩 | 关隘位置不可被他人号令（向操作者发送私密提示，同君主豁免处理方式一致） |
| 燕 | 游侠每个暗室类型额外 +3 分（基础公式中的系数从 5 变为 8） |

---

## 四、目录结构

```
项目根/
├── README.md              # 游戏规则权威文档（勿轻易修改）
├── NAISHI_QUICKREF.txt    # 精简规则速查
├── PLAN.md                # 本文件
│
├── shared/
│   ├── types.ts           # 全部核心类型（前后端共用）
│   └── constants.ts       # 卡池配置、棋盘规格等常量
│
├── server/
│   ├── index.ts           # Express + WebSocket 启动入口
│   ├── game/
│   │   ├── GameEngine.ts      # 状态机 + 行动合法性校验 + 状态更新
│   │   ├── ScoreEngine.ts     # 所有计分逻辑（纯函数，可独立单测）
│   │   ├── CardPool.ts        # 按人数生成牌池、洗牌
│   │   └── NationAbilities.ts # 七国宣国条件检验 + 能力触发
│   ├── ws/
│   │   ├── WsServer.ts        # WebSocket 服务器初始化
│   │   ├── RoomManager.ts     # 房间创建/加入/断线/销毁
│   │   ├── MessageHandler.ts  # 路由客户端消息到对应处理器
│   │   └── ViewProjector.ts   # 按玩家视角过滤 GameState
│   └── db/
│       ├── client.ts          # Turso 连接
│       └── queries.ts         # 所有数据库操作（房间、快照、会话）
│
└── client/
    └── src/
        ├── components/
        │   ├── Board.vue          # 明堂 + 暗室渲染
        │   ├── TalentPool.vue     # 英才区
        │   ├── ActionPanel.vue    # 六大行动选择面板
        │   ├── HandCards.vue      # 史书卡手牌
        │   └── PlayerStatus.vue  # 使节数量、国家、状态
        ├── views/
        │   ├── Lobby.vue          # 大厅（创建/输入房间号）
        │   └── Game.vue           # 游戏主页面
        ├── store/
        │   └── game.ts            # Pinia store，存储 GameView（客户端视角）
        └── ws/
            └── client.ts          # WebSocket 客户端封装，含自动重连
```

---

## 五、核心数据结构

```typescript
// shared/types.ts

// ── 基础枚举 ──────────────────────────────────────────

type CardType =
  | 'Wasteland'   // 荒地
  | 'Farmland'    // 农田
  | 'Strategist'  // 谋士
  | 'Lord'        // 君主
  | 'Cavalry'     // 骑兵
  | 'Banner'      // 旌旗
  | 'Pass'        // 关隘
  | 'City'        // 城邑
  | 'Wanderer';   // 游侠

// 客户端专用：表示被隐藏的格位
type HiddenCard = { type: 'HIDDEN' };

type Nation = '秦' | '齐' | '楚' | '赵' | '魏' | '韩' | '燕';

type HistoryCardType =
  | 'Alliance'      // 合纵之盟
  | 'BreakAlliance' // 连横破盟
  | 'WeiRescue'     // 围魏救赵
  | 'Apology'       // 负荆请罪
  | 'FarClose'      // 远交近攻
  | 'Diplomat'      // 纵横家
  | 'Spy'           // 反间计
  | 'Horsemanry';   // 胡服骑射

type GamePhase = 'WAITING' | 'DEALING' | 'PASSING' | 'PLAYING' | 'SCORING' | 'ENDED';
type TurnSubPhase = 'TURN_START' | 'ACTION_PENDING' | 'PROMPT_PENDING' | 'WAR_CHECK' | 'TURN_END';

// ── 卡牌 ──────────────────────────────────────────────

interface Card {
  id: string;      // 唯一 ID，e.g. "farmland-3"，用于追踪牌的流转
  type: CardType;
}

interface HistoryCard {
  id: string;
  type: HistoryCardType;
  used: boolean;
}

// ── 玩家状态（服务端完整版）────────────────────────────

interface PlayerState {
  id: string;
  name: string;
  mingTang: Card[];             // 长度 = gridSize，始终非空（初始全荒地）
  anShi: Card[];                // 长度 = gridSize，始终非空（初始全荒地）
  historyCards: HistoryCard[];
  nation: Nation | null;        // null = 白板
  nationDeclared: boolean;
  freeEnvoys: number;           // 当前空闲使节数（初始 3）
  hasExtraEnvoy: boolean;       // 魏国专属附加使节标记
  commandEnvoyRecallable: boolean; // 秦国宣国后变 true，号令使节可召回
  warBonus: number;             // 累计战争 ±5 分
  compensationBonus: number;    // 负荆请罪受偿累计
  warPenalties: number;         // 胡服骑射扣分累计
  peekCounts: Record<string, number>; // 齐国：对每个目标玩家的偷看次数
  // 传牌阶段临时用
  passingSelection?: { anShiIdx: number; historyIdx: number };
}

// ── 全局槽位占用（所有玩家共享）────────────────────────

interface SlotUsage {
  swap: number;      // 已使用交换槽
  discard: number;   // 已使用弃牌槽
  envoy: number;     // 已使用出使槽
  command: number;   // 已使用号令槽（永久累计）
}

// ── 在途使节（延迟战争）────────────────────────────────

interface EnvoyInFlight {
  id: string;
  fromPlayerId: string;
  toPlayerId: string;
  turnsLeft: number;  // 每经过一个玩家的正常回合 -1，减到 0 时触发战争结算
}

// ── 英才牌池 ───────────────────────────────────────────

interface TalentStack {
  col: number;        // 1-indexed
  cards: Card[];      // index 0 = 顶牌
}

// ── 需要玩家响应的提示 ─────────────────────────────────

interface PendingPrompt {
  type:
    | 'WEI_RESCUE_TARGET'   // 围魏救赵：让被指定玩家选一张明堂牌
    | 'SPY_REVEAL'          // 反间计：让两位玩家各挑一张暗室牌
    | 'QI_PEEK'             // 齐国偷看：问齐国玩家是否要偷看
    | 'DIPLOMAT_ACTION1'    // 纵横家：第一次行动
    | 'DIPLOMAT_ACTION2';   // 纵横家：第二次行动
  waitingFor: string[];     // 还在等待的玩家 id 列表
  data: Record<string, unknown>;
}

// ── 可选模块 ──────────────────────────────────────────

interface GameOptions {
  historyCards: boolean;     // 史书卡模块
  diplomacy: boolean;        // 出使/开战模块
  nationAbilities: boolean;  // 七国专属能力模块
}

// ── 完整游戏状态（服务端内存，权威）───────────────────

interface GameState {
  id: string;
  roomCode: string;
  phase: GamePhase;
  turnSubPhase: TurnSubPhase;
  options: GameOptions;
  gridSize: 5 | 7 | 9;
  players: PlayerState[];
  turnOrder: string[];           // player id 列表，按回合顺序
  currentPlayerIndex: number;    // 指向 turnOrder 的索引
  roundNumber: number;           // 游戏轮数（强制结算公平性判断用）
  talent: TalentStack[];
  slots: SlotUsage;              // 全局槽位
  envoysInFlight: EnvoyInFlight[];
  claimedNations: Set<Nation>;
  stacksExhausted: number;       // 已耗尽的英才叠数
  warsThisRound: number;         // 本轮已发生的战争次数（连横破盟判断用）
  allianceMap: Record<string, { targetId: string; untilRound: number }>;
  // key = playerId，value = 合纵之盟效果（到 untilRound 轮结束前有效）
  pendingPrompt: PendingPrompt | null;
  log: GameLogEntry[];           // 公开事件日志
}

// ── 客户端视角（暗室/史书卡被过滤）────────────────────

type PlayerView = Omit<PlayerState, 'anShi' | 'historyCards'> & {
  anShi: (Card | HiddenCard)[];
  historyCards: (HistoryCard | HiddenCard)[];
};

type GameView = Omit<GameState, 'players'> & {
  players: PlayerView[];
  myPlayerId: string;  // 告知客户端自己是哪个玩家
};
```

---

## 六、关键算法

### 6.1 镜像列（必须）

```typescript
// shared/utils.ts
export function mirrorCol(col: number, gridSize: number): number {
  return gridSize + 1 - col;
}
```

### 6.2 相邻判断（农田/城邑）

同一玩家的明堂 col N 和暗室 col N 视为上下相邻（跨区）。

```typescript
type Zone = 'mingTang' | 'anShi';

function isAdjacent(
  zoneA: Zone, colA: number,
  zoneB: Zone, colB: number
): boolean {
  if (zoneA === zoneB) {
    return Math.abs(colA - colB) === 1;   // 同区左右相邻
  } else {
    return colA === colB;                  // 跨区同列上下相邻
  }
}
```

### 6.3 农田连通组（BFS）

```typescript
function farmlandGroups(player: PlayerState): number[][] {
  // 返回每个连通分量（各自包含节点编号，格式任意）
  // 节点 = { zone, col }，用 isAdjacent 判断连通
  // 实现标准 BFS：维护 visited 集合，每次从未访问的农田节点出发
}

function farmlandScore(player: PlayerState): number {
  const groups = farmlandGroups(player);
  let score = 0;
  for (const group of groups) {
    const n = group.length;
    if (n === 1) { /* 单张不得分 */ }
    else if (n === 2) score += 10;
    else if (n === 3) score += 20;
    else if (player.nation === '楚' && n >= 5) score += 40;
    else score += 30; // n >= 4
  }
  return score;
}
```

### 6.4 谋士基础分

```typescript
function strategistScore(
  col: number,
  gridSize: number,
  adjacentToLord: boolean
): number {
  const lordCol = Math.ceil(gridSize / 2);
  const target1 = lordCol - 1;
  const target2 = lordCol + 1;
  const D = Math.min(Math.abs(col - target1), Math.abs(col - target2));
  const base = Math.max(2, 5 - D);
  return base + (adjacentToLord ? 6 : 0);
}
```

### 6.5 旌旗计分（整体定档）

```typescript
function bannerScore(mingTangCards: Card[]): number {
  const count = mingTangCards.filter(c => c.type === 'Banner').length;
  if (count === 0) return 0;
  if (count === 1) return 3;
  if (count === 2) return 8;
  return 15; // 3+张
}
// 注意：这是该玩家所有旌旗的合计得分，不是每张单独 +8
```

### 6.6 骑兵计分

```typescript
function cavalryScore(
  player: PlayerState,
  col: number  // 该骑兵在暗室中的列
): number {
  const hasMatchingBanner = player.mingTang[col - 1]?.type === 'Banner';
  const base = hasMatchingBanner ? 10 : 3;
  return player.nation === '赵' ? base * 2 : base;
}
```

### 6.7 游侠计分

```typescript
function wandererScore(player: PlayerState): number {
  const typesInAnShi = new Set(
    player.anShi
      .map(c => c.type)
      .filter(t => t !== 'Wasteland')  // 荒地不算独立类型
  );
  return 5 + 5 * typesInAnShi.size + (player.nation === '燕' ? 3 * typesInAnShi.size : 0);
}
```

### 6.8 在途使节计时

每当一个玩家的**正常回合**结束（不含纵横家/史书卡额外行动），对所有 `envoysInFlight` 执行：

```typescript
function tickEnvoysInFlight(state: GameState): void {
  for (const envoy of state.envoysInFlight) {
    envoy.turnsLeft--;
    if (envoy.turnsLeft <= 0) {
      resolveWar(state, envoy.fromPlayerId, envoy.toPlayerId);
      // 从 envoysInFlight 中移除，但使节留在出使槽等待召回
    }
  }
}
```

---

## 七、WebSocket 通信协议

### 7.1 消息格式

```typescript
// 客户端 → 服务端
interface ClientMessage {
  type: ClientMessageType;
  payload: unknown;
}

// 服务端 → 客户端（每次状态变更后按玩家过滤广播）
interface ServerMessage {
  type: ServerMessageType;
  payload: unknown;
}
```

### 7.2 客户端发送的消息类型

```typescript
type ClientMessageType =
  | 'CREATE_ROOM'      // { playerName, options: GameOptions }
  | 'JOIN_ROOM'        // { roomCode, playerName }
  | 'START_GAME'       // {} 仅房主可发
  | 'SUBMIT_PASS'      // { anShiCardIndex: number, historyCardIndex: number } 传牌阶段
  | 'ACTION'           // { action: ActionPayload }
  | 'PROMPT_RESPONSE'  // { ...选择内容 } 响应服务端 PROMPT
  | 'QI_PEEK_CHOICE';  // { targetPlayerId: string | null } null 表示跳过偷看
```

### 7.3 服务端发送的消息类型

```typescript
type ServerMessageType =
  | 'ROOM_INFO'        // 房间信息更新（玩家列表、选项）
  | 'GAME_VIEW'        // 完整视角更新，发给所有人（已过滤），任何状态变化后广播
  | 'ACTION_RESULT'    // { success: boolean, error?: string } 仅发给操作者
  | 'PROMPT'           // { promptType, ...params } 要求特定玩家做决定
  | 'PEEK_REVEAL'      // { targetPlayerId, col, cardType } 齐国偷看结果，仅发给齐国
  | 'PRIVATE_INFO'     // { message: string } 私密提示（号令失败等），仅发给操作者
  | 'GAME_EVENT'       // { eventType, ...data } 公开事件（战争结果、宣国成功等）
  | 'ERROR';           // { message: string } 错误
```

### 7.4 ACTION payload 定义

```typescript
type ActionPayload =
  | {
      type: 'RECRUIT';
      talentCol: number;
      targetZone: 'mingTang' | 'anShi';
      targetCol: number;
      // 可选附加行动（二选一）
      swap?: { zoneA: 'mingTang'|'anShi'; colA: number; zoneB: 'mingTang'|'anShi'; colB: number };
      discard?: { talentColA: number; talentColB: number };
    }
  | { type: 'ENVOY'; targetPlayerId: string }
  | {
      type: 'COMMAND';
      myZone: 'mingTang' | 'anShi';
      myCol: number;
      targetPlayerId: string;
      // targetCol 由服务端通过 mirrorCol() 计算，客户端不传
    }
  | { type: 'RECALL' }
  | { type: 'DECLARE_NATION'; nation: Nation }
  | { type: 'HEGEMONY' }
  | { type: 'HISTORY_CARD'; cardType: HistoryCardType; params: Record<string, unknown> };
```

### 7.5 ViewProjector

```typescript
// server/ws/ViewProjector.ts
export function projectForPlayer(state: GameState, viewerId: string): GameView {
  return {
    ...state,
    myPlayerId: viewerId,
    players: state.players.map(p => {
      const isSelf = p.id === viewerId;
      const isRevealed = p.nationDeclared; // 宣国后暗室永久公开
      if (isSelf || isRevealed) {
        return p as PlayerView;
      }
      return {
        ...p,
        anShi: p.anShi.map(() => ({ type: 'HIDDEN' as const })),
        historyCards: p.historyCards.map(() => ({ type: 'HIDDEN' as const })),
      };
    }),
  };
}
```

---

## 八、数据库结构（Turso）

活跃游戏的 `GameState` 存于服务器内存。Turso 的职责是：
1. 记录房间元数据（供大厅展示）
2. 在每步行动后快照游戏状态（供断线重连）
3. 记录玩家 session（供重连时身份恢复）

```sql
CREATE TABLE rooms (
  room_code   TEXT PRIMARY KEY,
  host_id     TEXT NOT NULL,
  player_count INTEGER,
  options     TEXT,          -- JSON 序列化的 GameOptions
  status      TEXT,          -- 'waiting' | 'playing' | 'ended'
  created_at  INTEGER        -- Unix 时间戳
);

CREATE TABLE game_snapshots (
  room_code   TEXT PRIMARY KEY,
  state_json  TEXT NOT NULL, -- JSON 序列化的 GameState
  updated_at  INTEGER,
  FOREIGN KEY (room_code) REFERENCES rooms(room_code)
);

CREATE TABLE player_sessions (
  player_id   TEXT PRIMARY KEY,
  room_code   TEXT,
  player_name TEXT,
  socket_id   TEXT,          -- 当前 WebSocket 连接 ID，断线时置 null
  connected_at INTEGER,
  FOREIGN KEY (room_code) REFERENCES rooms(room_code)
);
```

**快照策略**：每次 `GameEngine` 处理完一个行动并更新状态后，异步（不阻塞回合流程）将序列化的 `GameState` 写入 `game_snapshots`。重连时从 Turso 读取快照重建内存状态。

---

## 九、实现顺序（分阶段，每阶段可独立测试）

### Phase 1 — 基础类型和常量（无依赖）
- `shared/types.ts`：完整类型定义（见第五章）
- `shared/constants.ts`：
  - 每人数对应的卡池（见 README 6.4）
  - 棋盘规格（gridSize、君主位、称霸/强制结算叠数）
  - 槽位数量配置

### Phase 2 — 核心游戏逻辑（纯函数，不依赖网络/数据库）
- `server/game/CardPool.ts`：按人数生成牌池 + Fisher-Yates 洗牌
- `server/game/ScoreEngine.ts`：完整计分（所有卡牌 + 七国加成）
  - 可用 vitest 写单元测试，不需要启动服务器
- `server/game/NationAbilities.ts`：宣国条件检验、能力触发逻辑
- `server/game/GameEngine.ts`：
  - 状态机转换（`GamePhase` 推进）
  - 六大行动合法性校验
  - 行动执行（状态更新）
  - 战争解算（`resolveWar`）
  - 游戏结束判断

### Phase 3 — 服务器层
- `server/db/client.ts` + `queries.ts`：Turso 连接和基础 CRUD
- `server/ws/ViewProjector.ts`
- `server/ws/RoomManager.ts`：管理房间和 WebSocket 连接池，处理断线
- `server/ws/MessageHandler.ts`：路由消息到 GameEngine
- `server/ws/WsServer.ts` + `server/index.ts`：启动入口

### Phase 4 — 前端基础（先不做美化）
- `client/ws/client.ts`：WebSocket 封装，含指数退避自动重连
- `client/store/game.ts`：Pinia store，存储 `GameView`
- `Lobby.vue`：创建/加入房间
- `Game.vue` + `Board.vue`：最简棋盘渲染（能看到牌就行）
- `ActionPanel.vue`：行动选择按钮

### Phase 5 — 史书卡 + 七国能力
- 在 `GameEngine` 内按 `HistoryCardType` 分支实现各卡效果
- `NationAbilities.ts` 完善（齐国偷看计数、秦国召回转换等）
- 前端增加史书卡手牌 UI 和相关提示

### Phase 6 — 完善与优化
- 可选模块开关（`GameOptions` 已在类型中定义，Phase 2 实现时跳过被关闭的功能）
- 断线重连完整流程测试
- 前端 UI 美化

---

## 十、易错的边界情况

| 场景 | 处理方式 |
|------|---------|
| 号令/换牌 的列映射 | **始终**经过 `mirrorCol()`，客户端只传己方列号 |
| 号令目标是君主牌 | 操作中止，仅向操作者发 `PRIVATE_INFO`，其他人不知情 |
| 韩国关隘位置被号令 | 同上，私密拒绝，不公开 |
| 旌旗计分 | 是该玩家所有明堂旌旗的**合计总档**，不是每张单算 |
| 游侠类型计数 | 荒地不计入类型数（在 `wandererScore` 中 filter 掉） |
| 强制结算公平性 | 检查本轮各玩家 `roundNumber` 是否一致；史书卡额外行动不推进 `roundNumber` |
| 称霸时轮数已对齐 | 仍然强制让其余玩家各补 1 轮（与强制结算不同） |
| 合纵之盟追踪 | 在 `allianceMap` 中记录到期轮数，每轮结束清理过期条目 |
| 连横破盟触发条件 | 每轮开始时重置 `warsThisRound`；玩家在自己回合判断是否可打出 |
| 赵国骑兵翻倍 | 翻倍适用于所有骑兵（无旌旗的 +3 也翻倍为 +6） |
| 秦国号令槽非永久化 | 宣国后设置 `commandEnvoyRecallable = true`，召回行动时不跳过号令槽 |
| 魏国附加使节 | 可召回，但行动合法性检查时需验证：只能用于交换/弃牌附加行动 |
| 齐国偷看计数 | 用 `peekCounts[targetId]`，每次偷看 +1；偶数次时触发强制展示己方暗室 |
| 传牌阶段并发 | 服务端等待**所有玩家**提交 `SUBMIT_PASS` 后，统一处理传牌，不逐一处理 |
| 荒地初始生成 | 荒地**不在英才中出现**，只在初始状态填充暗室/明堂空格位 |
