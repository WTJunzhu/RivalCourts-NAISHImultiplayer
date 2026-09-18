<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { CARD_LABELS, NATIONS, SLOT_LIMITS } from '../../../shared/constants';
import { sel, resetSel } from '../composables/selection';
import { useGameStore } from '../store/game';

const store = useGameStore();
const nation = ref(NATIONS[0]);
const revealCols = ref<number[]>([]);
const errTimer = ref<ReturnType<typeof setTimeout> | null>(null);

const view = computed(() => store.view!);
const me = computed(() => store.me);
const isMyTurn = computed(() => store.isMyTurn);
const gridSize = computed(() => view.value?.gridSize ?? 5);
const limits = computed(() => SLOT_LIMITS[gridSize.value as keyof typeof SLOT_LIMITS]);
const slots = computed(() => view.value?.slots ?? { swap: 0, discard: 0, envoy: 0, command: 0 });
const others = computed(() => view.value?.players.filter(p => p.id !== view.value?.myPlayerId) ?? []);

// Pending recruit info
const boardCard = computed(() => {
  if (!sel.pendingRecruit || !me.value) return null;
  const z = sel.pendingRecruit.zone;
  return (me.value as any)[z]?.[sel.pendingRecruit.col - 1] ?? null;
});
const talentCard = computed(() => {
  if (!sel.pendingRecruit || !view.value) return null;
  return view.value.talent[sel.pendingRecruit.col - 1]?.cards[0] ?? null;
});
function cardLabel(card: any): string {
  if (!card) return '空';
  return CARD_LABELS[card.type as keyof typeof CARD_LABELS] ?? card.type ?? '未知';
}

// Pending PEEK_REVEAL
const pendingReveal = computed(() => {
  const p = view.value?.pendingPrompt;
  return p?.type === 'PEEK_REVEAL' ? p : null;
});
const revealTargetName = computed(() =>
  pendingReveal.value
    ? view.value?.players.find(p => p.id === pendingReveal.value!.targetPlayerId)?.name ?? ''
    : '');

// Addon readiness
const swapComplete = computed(() => sel.swapA !== null && sel.swapB !== null);
const discardComplete = computed(() => sel.discardA !== null && sel.discardB !== null);
const addonConfigured = computed(() => sel.swapA !== null || sel.discardA !== null);

// Envoy board availabilities
const canInitSwap = computed(() => (me.value?.freeEnvoys ?? 0) > 0 && slots.value.swap < limits.value.swap && sel.swapA === null);
const canInitDiscard = computed(() => (me.value?.freeEnvoys ?? 0) > 0 && slots.value.discard < limits.value.discard && sel.discardA === null);
const canInitCommand = computed(() => (me.value?.nationDeclared ?? false) && (me.value?.freeEnvoys ?? 0) > 0 && slots.value.command < limits.value.command);
const canInitEnvoy = computed(() => (me.value?.nationDeclared ?? false) && (me.value?.freeEnvoys ?? 0) > 0 && slots.value.envoy < limits.value.envoy);
const showDiplomacy = computed(() => view.value?.options.diplomacy && (view.value?.claimedNations.length ?? 0) > 0);

// 齐国 peek
const canPeek = computed(() =>
  me.value?.nation === '齐' && me.value?.nationDeclared &&
  !me.value?.hasPeekedThisTurn && isMyTurn.value && !pendingReveal.value
);

const modeBanner: Record<string, string> = {
  'swap-a': '点击英才叠（交换第一叠）',
  'swap-b': '点击英才叠（交换第二叠）',
  'discard-a': '点击英才叠（弃牌第一列）',
  'discard-b': '点击英才叠（弃牌第二列）',
  command: '点击自己的格子（号令源位置）',
  envoy: '选择出使目标玩家',
  peek: '点击对手暗室中任意格子进行偷看',
};

function slotCircles(type: 'swap' | 'discard' | 'envoy' | 'command') {
  const max = limits.value[type];
  const used = slots.value[type];
  return Array.from({ length: max }, (_, i) => i < used);
}

function circleClick(type: 'swap' | 'discard' | 'command' | 'envoy', filled: boolean) {
  if (filled || !isMyTurn.value) return;
  if (type === 'swap' && canInitSwap.value) sel.mode = 'swap-a';
  if (type === 'discard' && canInitDiscard.value) sel.mode = 'discard-a';
  if (type === 'command' && canInitCommand.value) { sel.mode = 'command'; sel.commandZone = null; sel.commandCol = null; }
  if (type === 'envoy' && canInitEnvoy.value) sel.mode = 'envoy';
}

function doRecruit() {
  if (!sel.pendingRecruit) return;
  const payload: any = { type: 'RECRUIT', targetZone: sel.pendingRecruit.zone, targetCol: sel.pendingRecruit.col };
  if (swapComplete.value) payload.swap = { talentColA: sel.swapA!, talentColB: sel.swapB! };
  if (discardComplete.value) payload.discard = { talentColA: sel.discardA!, talentColB: sel.discardB! };
  store.action(payload);
  resetSel();
}

function doCommand() {
  if (!sel.commandZone || !sel.commandCol || !sel.commandTarget) return;
  store.action({ type: 'COMMAND', myZone: sel.commandZone, myCol: sel.commandCol, targetPlayerId: sel.commandTarget });
  resetSel();
}

function doEnvoy() {
  if (!sel.envoyTarget) return;
  store.action({ type: 'ENVOY', targetPlayerId: sel.envoyTarget });
  resetSel();
}

function doRecall() { store.action({ type: 'RECALL' }); resetSel(); }
function doHegemony() { store.action({ type: 'HEGEMONY' }); resetSel(); }
function doDeclare() { store.action({ type: 'DECLARE_NATION', nation: nation.value }); }
function startPeek() { sel.mode = 'peek'; }

function toggleRevealCol(col: number) {
  if (!pendingReveal.value) return;
  const idx = revealCols.value.indexOf(col);
  if (idx >= 0) revealCols.value.splice(idx, 1);
  else if (revealCols.value.length < pendingReveal.value.revealCount) revealCols.value.push(col);
}

function confirmReveal() {
  if (!pendingReveal.value || revealCols.value.length !== pendingReveal.value.revealCount) return;
  store.action({ type: 'PEEK_REVEAL', anShiCols: [...revealCols.value] });
  revealCols.value = [];
}

watch(() => store.error, v => {
  if (!v) return;
  if (errTimer.value) clearTimeout(errTimer.value);
  errTimer.value = setTimeout(() => { store.error = ''; }, 4000);
});
</script>

<template>
<section class="panel" v-if="view">
  <div v-if="!isMyTurn" class="wait-msg">等待 {{ store.currentPlayer?.name }} 行动…</div>

  <template v-else>
    <!-- PEEK_REVEAL blocks everything — reveal OWN anShi to target -->
    <div v-if="pendingReveal" class="prompt-box">
      <p class="prompt-title">齐国·偷看展示</p>
      <p>需向 <b>{{ revealTargetName }}</b> 展示你自己的 {{ pendingReveal.revealCount }} 张暗室牌</p>
      <p class="prompt-hint">（已选 {{ revealCols.length }}/{{ pendingReveal.revealCount }}）点击自己暗室格子选择：</p>
      <div class="grid" :style="{ '--cols': gridSize }">
        <div v-for="(card, i) in me?.anShi" :key="i"
             class="cell clickable"
             :class="{ 'sel-target': revealCols.includes(i+1) }"
             @click="toggleRevealCol(i+1)">
          <div class="card" :class="card?.type">
            <strong>{{ cardLabel(card) }}</strong>
          </div>
        </div>
      </div>
      <button :disabled="revealCols.length !== pendingReveal.revealCount" @click="confirmReveal">
        确认展示
      </button>
    </div>

    <template v-else>
      <!-- Addon-lock banner -->
      <div v-if="addonConfigured && !sel.pendingRecruit" class="sel-mode-banner lock-banner">
        已设置附加行动，请点击自己格子完成招贤纳士
      </div>

      <!-- Mode banner -->
      <div v-else-if="sel.mode" class="sel-mode-banner">
        {{ modeBanner[sel.mode] }}
        <button class="btn-sm" @click="sel.mode = null">取消</button>
      </div>

      <!-- Instruction (idle state) -->
      <div v-else class="turn-hint">
        可先设置附加行动（使节板），然后点击自己格子招贤；<br>或直接点击格子选择招贤位置
      </div>

      <!-- Addon status display -->
      <div v-if="sel.swapA !== null || sel.discardA !== null" class="addon-status">
        <span v-if="sel.swapA !== null">
          交换: 列{{ sel.swapA }}↔{{ sel.swapB !== null ? `列${sel.swapB}` : '…' }}
        </span>
        <span v-if="sel.discardA !== null">
          弃牌: 列{{ sel.discardA }}+{{ sel.discardB !== null ? `列${sel.discardB}` : '…' }}
        </span>
        <button class="btn-xs" @click="() => { sel.swapA = null; sel.swapB = null; sel.discardA = null; sel.discardB = null; }">清除附加</button>
      </div>

      <!-- Recruit confirmation card -->
      <div v-if="sel.pendingRecruit" class="recruit-confirm">
        <div class="recruit-info">
          <div>
            <div class="rc-label">当前格位（将弃置）</div>
            <div class="card" :class="boardCard?.type" style="min-width:70px">
              <strong>{{ cardLabel(boardCard) }}</strong>
            </div>
          </div>
          <div class="rc-arrow">→</div>
          <div>
            <div class="rc-label">列{{ sel.pendingRecruit.col }} 英才（将补入）</div>
            <div class="card" :class="talentCard?.type" style="min-width:70px">
              <strong>{{ cardLabel(talentCard) }}</strong>
            </div>
          </div>
        </div>
        <p class="rc-zone">位置：{{ sel.pendingRecruit.zone === 'mingTang' ? '明堂' : '暗室' }} 第{{ sel.pendingRecruit.col }}列</p>
        <div class="rc-addons" v-if="swapComplete || discardComplete">
          <span v-if="swapComplete">＋交换列{{ sel.swapA }}↔列{{ sel.swapB }}</span>
          <span v-if="discardComplete">＋弃牌列{{ sel.discardA }}/列{{ sel.discardB }}</span>
        </div>
        <div style="display:flex;gap:.5rem;margin-top:.5rem">
          <button :disabled="!talentCard" @click="doRecruit" style="flex:1">
            {{ !talentCard ? '该列无英才' : '确认招贤' }}
          </button>
          <button class="btn-sm" @click="sel.pendingRecruit = null">取消</button>
        </div>
      </div>

      <!-- Envoy board -->
      <div class="envoy-board">
        <div class="board-title">使节板 · 余 {{ me?.freeEnvoys ?? 0 }}</div>
        <div class="slot-row">
          <span class="slot-label">交换</span>
          <div v-for="(filled, i) in slotCircles('swap')" :key="i"
               class="slot-circle"
               :class="{ filled, 'can-fill': !filled && canInitSwap && sel.mode === null, 'active-slot': sel.mode === 'swap-a' || sel.mode === 'swap-b' }"
               @click="circleClick('swap', filled)">
          </div>
          <span class="slot-tip" v-if="!canInitSwap && !slotCircles('swap').every(Boolean)">使节不足或槽满</span>
        </div>
        <div class="slot-row">
          <span class="slot-label">弃牌</span>
          <div v-for="(filled, i) in slotCircles('discard')" :key="i"
               class="slot-circle"
               :class="{ filled, 'can-fill': !filled && canInitDiscard && sel.mode === null, 'active-slot': sel.mode === 'discard-a' || sel.mode === 'discard-b' }"
               @click="circleClick('discard', filled)">
          </div>
        </div>
        <div v-if="me?.nationDeclared" class="slot-row">
          <span class="slot-label">号令</span>
          <div v-for="(filled, i) in slotCircles('command')" :key="i"
               class="slot-circle"
               :class="{ filled, 'can-fill': !filled && canInitCommand && sel.mode === null, 'active-slot': sel.mode === 'command' }"
               @click="circleClick('command', filled)">
          </div>
        </div>
        <div v-if="showDiplomacy && me?.nationDeclared" class="slot-row">
          <span class="slot-label">出使</span>
          <div v-for="(filled, i) in slotCircles('envoy')" :key="i"
               class="slot-circle"
               :class="{ filled, 'can-fill': !filled && canInitEnvoy && sel.mode === null, 'active-slot': sel.mode === 'envoy' }"
               @click="circleClick('envoy', filled)">
          </div>
        </div>
      </div>

      <!-- Command sub-form -->
      <div v-if="sel.mode === 'command' && sel.commandZone && sel.commandCol" class="sub-form">
        <span>号令源: {{ sel.commandZone === 'mingTang' ? '明堂' : '暗室' }}第{{ sel.commandCol }}列</span>
        <select v-model="sel.commandTarget">
          <option value="">选择目标玩家</option>
          <option v-for="p in others" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
        <button :disabled="!sel.commandTarget" @click="doCommand">确认号令</button>
      </div>

      <!-- Envoy sub-form -->
      <div v-if="sel.mode === 'envoy'" class="sub-form">
        <select v-model="sel.envoyTarget">
          <option value="">选择出使目标</option>
          <option v-for="p in others" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
        <button :disabled="!sel.envoyTarget" @click="doEnvoy">确认出使</button>
      </div>

      <!-- Other actions (hidden when addon configured before recruit) -->
      <div v-if="!addonConfigured" class="bottom-row">
        <button @click="doRecall">召回</button>
        <template v-if="!me?.nationDeclared">
          <select v-model="nation">
            <option v-for="n in NATIONS" :key="n">{{ n }}</option>
          </select>
          <button @click="doDeclare">宣国</button>
        </template>
        <button v-if="me?.nationDeclared" @click="doHegemony">称霸</button>
        <button v-if="canPeek" class="btn-peek" @click="startPeek">偷看（齐）</button>
      </div>
      <div v-else-if="addonConfigured && !sel.pendingRecruit" class="bottom-row">
        <button class="btn-sm" @click="() => { sel.swapA = null; sel.swapB = null; sel.discardA = null; sel.discardB = null; }">
          放弃附加，改做其他
        </button>
      </div>
    </template>
  </template>

  <p class="error" v-if="store.error">{{ store.error }}</p>
  <p class="ok" v-if="store.lastResult === '行动成功' && !store.error">✓ 行动成功</p>
</section>
</template>
