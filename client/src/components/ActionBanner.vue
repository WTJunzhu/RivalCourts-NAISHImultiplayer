<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { CARD_LABELS, NATIONS } from '../../../shared/constants';
import { sel, resetSel } from '../composables/selection';
import { useGameStore } from '../store/game';

const store = useGameStore();
const nation = ref(NATIONS[0]);
const revealCols = ref<number[]>([]);
const errTimer = ref<ReturnType<typeof setTimeout> | null>(null);

const view = computed(() => store.view!);
const me = computed(() => store.me);
const isMyTurn = computed(() => store.isMyTurn);
const others = computed(() => view.value?.players.filter(p => p.id !== view.value?.myPlayerId) ?? []);

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

const pendingReveal = computed(() => {
  const p = view.value?.pendingPrompt;
  return p?.type === 'PEEK_REVEAL' ? p : null;
});
const revealTargetName = computed(() =>
  pendingReveal.value
    ? view.value?.players.find(p => p.id === pendingReveal.value!.targetPlayerId)?.name ?? ''
    : '');

const swapComplete = computed(() => sel.swapA !== null && sel.swapB !== null);
const discardComplete = computed(() => sel.discardA !== null && sel.discardB !== null);
const addonConfigured = computed(() => sel.swapA !== null || sel.discardA !== null);

const canPeek = computed(() =>
  me.value?.nation === '齐' && me.value?.nationDeclared &&
  !me.value?.hasPeekedThisTurn && isMyTurn.value && !pendingReveal.value
);

const modeBannerText: Record<string, string> = {
  'swap-a': '点击英才叠（交换第一叠）',
  'swap-b': '点击英才叠（交换第二叠）',
  'discard-a': '点击英才叠（弃牌第一列）',
  'discard-b': '点击英才叠（弃牌第二列）',
  command: '点击自己的格子（号令源位置）',
  envoy: '选择出使目标玩家',
  peek: '点击对手暗室中任意格子进行偷看',
};

function doRecruit() {
  if (!sel.pendingRecruit) return;
  const payload: any = {
    type: 'RECRUIT',
    targetZone: sel.pendingRecruit.zone,
    targetCol: sel.pendingRecruit.col,
  };
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
<section class="action-banner" v-if="view">
  <!-- Left: status text -->
  <div class="banner-left">
    <div v-if="!isMyTurn" class="banner-status wait">
      ⏳ 等待 <b>{{ store.currentPlayer?.name }}</b> 行动…
    </div>
    <div v-else-if="pendingReveal" class="banner-status prompt-status">
      🔍 齐国·偷看展示 — 需向 <b>{{ revealTargetName }}</b> 展示 {{ pendingReveal.revealCount }} 张暗室牌
    </div>
    <div v-else-if="addonConfigured && !sel.pendingRecruit" class="banner-status lock">
      🔒 已设置附加行动，请点击自己格子完成招贤纳士
    </div>
    <div v-else-if="sel.mode" class="banner-status mode">
      📌 {{ modeBannerText[sel.mode] }}
    </div>
    <div v-else class="banner-status hint">
      轮到你了 — 可先设置附加行动，再点击格子招贤；或直接点击格子招贤
    </div>
    <div class="banner-feedback">
      <span class="error" v-if="store.error">⚠ {{ store.error }}</span>
      <span class="ok" v-else-if="store.lastResult === '行动成功'">✓ 行动成功</span>
    </div>
  </div>

  <!-- Right: action controls -->
  <div class="banner-right" v-if="isMyTurn">

    <!-- PEEK_REVEAL prompt -->
    <div v-if="pendingReveal" class="banner-reveal">
      <span class="reveal-hint">已选 {{ revealCols.length }}/{{ pendingReveal.revealCount }}，点击暗室格选择：</span>
      <div class="reveal-row">
        <div v-for="(card, i) in me?.anShi" :key="i"
             class="cell clickable"
             :class="{ 'sel-target': revealCols.includes(i+1) }"
             @click="toggleRevealCol(i+1)">
          <div class="card" :class="(card as any)?.type" style="min-width:48px;font-size:.75rem">
            <strong>{{ cardLabel(card) }}</strong>
          </div>
        </div>
      </div>
      <button :disabled="revealCols.length !== pendingReveal.revealCount"
              @click="confirmReveal" class="btn-sm">确认展示</button>
    </div>

    <template v-else>
      <!-- Addon status badge -->
      <div v-if="sel.swapA !== null || sel.discardA !== null" class="addon-status">
        <span v-if="sel.swapA !== null">
          交换 列{{ sel.swapA }}↔{{ sel.swapB !== null ? `列${sel.swapB}` : '…' }}
        </span>
        <span v-if="sel.discardA !== null">
          弃牌 列{{ sel.discardA }}+{{ sel.discardB !== null ? `列${sel.discardB}` : '…' }}
        </span>
        <button class="btn-xs" @click="() => { sel.swapA = null; sel.swapB = null; sel.discardA = null; sel.discardB = null; }">清除</button>
      </div>

      <!-- Recruit confirm -->
      <div v-if="sel.pendingRecruit" class="recruit-confirm">
        <div class="recruit-info">
          <div>
            <div class="rc-label">弃置</div>
            <div class="card" :class="boardCard?.type" style="min-width:52px;font-size:.75rem">
              <strong>{{ cardLabel(boardCard) }}</strong>
            </div>
          </div>
          <div class="rc-arrow">→</div>
          <div>
            <div class="rc-label">列{{ sel.pendingRecruit.col }}英才</div>
            <div class="card" :class="talentCard?.type" style="min-width:52px;font-size:.75rem">
              <strong>{{ cardLabel(talentCard) }}</strong>
            </div>
          </div>
          <div class="rc-buttons">
            <button :disabled="!talentCard" @click="doRecruit" class="btn-sm">
              {{ !talentCard ? '无英才' : '确认招贤' }}
            </button>
            <button class="btn-xs" @click="sel.pendingRecruit = null">取消</button>
          </div>
        </div>
        <div class="rc-addons" v-if="swapComplete || discardComplete">
          <span v-if="swapComplete">＋交换列{{ sel.swapA }}↔列{{ sel.swapB }}</span>
          <span v-if="discardComplete">＋弃牌列{{ sel.discardA }}/列{{ sel.discardB }}</span>
        </div>
      </div>

      <!-- Mode cancel -->
      <button v-if="sel.mode" class="btn-sm" @click="sel.mode = null">✕ 取消</button>

      <!-- Command sub-form -->
      <div v-if="sel.mode === 'command' && sel.commandZone && sel.commandCol" class="sub-form">
        <span>号令源: {{ sel.commandZone === 'mingTang' ? '明堂' : '暗室' }}第{{ sel.commandCol }}列</span>
        <select v-model="sel.commandTarget">
          <option value="">选择目标玩家</option>
          <option v-for="p in others" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
        <button :disabled="!sel.commandTarget" @click="doCommand" class="btn-sm">确认号令</button>
      </div>

      <!-- Envoy sub-form -->
      <div v-if="sel.mode === 'envoy'" class="sub-form">
        <select v-model="sel.envoyTarget">
          <option value="">选择出使目标</option>
          <option v-for="p in others" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
        <button :disabled="!sel.envoyTarget" @click="doEnvoy" class="btn-sm">确认出使</button>
      </div>

      <!-- Bottom actions row -->
      <div v-if="!addonConfigured" class="banner-actions">
        <button class="btn-sm" @click="doRecall">召回</button>
        <template v-if="!me?.nationDeclared">
          <select v-model="nation" class="nation-select">
            <option v-for="n in NATIONS" :key="n">{{ n }}</option>
          </select>
          <button class="btn-sm" @click="doDeclare">宣国</button>
        </template>
        <button v-if="me?.nationDeclared" class="btn-sm" @click="doHegemony">称霸</button>
        <button v-if="canPeek" class="btn-sm btn-peek" @click="startPeek">偷看（齐）</button>
      </div>
      <div v-else-if="addonConfigured && !sel.pendingRecruit" class="banner-actions">
        <button class="btn-sm" @click="() => { sel.swapA = null; sel.swapB = null; sel.discardA = null; sel.discardB = null; }">
          放弃附加，改做其他
        </button>
      </div>
    </template>
  </div>
</section>
</template>
