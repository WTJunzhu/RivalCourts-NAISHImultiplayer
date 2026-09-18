<script setup lang="ts">
import { computed } from 'vue';
import type { Zone } from '../../../shared/types';
import { CARD_LABELS } from '../../../shared/constants';
import { sel } from '../composables/selection';
import { useGameStore } from '../store/game';
import CardTile from './CardTile.vue';

const props = defineProps<{
  players: any[];
  myId: string;
  talent: any[];
  expandedId: string | null;
}>();

const emit = defineEmits<{
  expand: [id: string | null];
}>();

const store = useGameStore();
const isMyTurn = computed(() => store.isMyTurn);
const me = computed(() => props.players.find(p => p.id === props.myId));
const opponents = computed(() => props.players.filter(p => p.id !== props.myId));
const expandedPlayer = computed(() =>
  props.expandedId ? props.players.find(p => p.id === props.expandedId) ?? null : null);

function cardLabel(card: any): string {
  if (!card) return '空';
  return CARD_LABELS[card.type as keyof typeof CARD_LABELS] ?? '?';
}

function onOwnCellClick(zone: Zone, col: number) {
  if (!isMyTurn.value) return;
  if (sel.mode === 'command') {
    sel.commandZone = zone;
    sel.commandCol = col;
    return;
  }
  if (sel.pendingRecruit?.zone === zone && sel.pendingRecruit?.col === col) {
    sel.pendingRecruit = null;
  } else {
    sel.pendingRecruit = { zone, col };
  }
}

function onOpponentAnShiClick(playerId: string, col: number) {
  if (!isMyTurn.value || sel.mode !== 'peek') return;
  store.action({ type: 'PEEK', targetPlayerId: playerId, anShiCol: col });
  sel.mode = null;
}

function ownCellClass(zone: Zone, col: number): string[] {
  const cs: string[] = ['cell'];
  if (isMyTurn.value) cs.push('clickable');
  if (sel.pendingRecruit?.zone === zone && sel.pendingRecruit?.col === col) cs.push('sel-target');
  if (sel.commandZone === zone && sel.commandCol === col) cs.push('sel-command');
  return cs;
}

function oppAnShiCellClass(): string[] {
  const cs: string[] = ['cell'];
  if (isMyTurn.value && sel.mode === 'peek') cs.push('clickable', 'peek-hint');
  return cs;
}

// Talent stack click handling is in TalentPool, but we render inline here for layout
function onTalentClick(col: number) {
  if (!isMyTurn.value) return;
  if (sel.mode === 'swap-a') { sel.swapA = col; sel.mode = 'swap-b'; }
  else if (sel.mode === 'swap-b') { sel.swapB = col; sel.mode = null; }
  else if (sel.mode === 'discard-a') { sel.discardA = col; sel.mode = 'discard-b'; }
  else if (sel.mode === 'discard-b') { sel.discardB = col; sel.mode = null; }
}

function talentStackClass(col: number): string[] {
  const cs: string[] = ['talent-stack'];
  const selectable = isMyTurn.value &&
    (sel.mode === 'swap-a' || sel.mode === 'swap-b' ||
     sel.mode === 'discard-a' || sel.mode === 'discard-b');
  if (selectable) cs.push('clickable');
  if (sel.swapA === col || sel.swapB === col) cs.push('sel-swap');
  if (sel.discardA === col || sel.discardB === col) cs.push('sel-discard');
  return cs;
}
</script>

<template>
<div class="center-zone">

  <!-- ── EXPANDED VIEW ── -->
  <template v-if="expandedPlayer">
    <div class="zone-header">
      <button class="btn-sm back-btn" @click="emit('expand', null)">← 返回概览</button>
      <span class="zone-title">
        {{ expandedPlayer.name }}
        <span v-if="expandedPlayer.nation && expandedPlayer.nationDeclared" class="nation-badge">
          {{ expandedPlayer.nation }}
        </span>
      </span>
      <span class="zone-envoy">使节 {{ expandedPlayer.freeEnvoys }}</span>
    </div>

    <!-- Row 1: Opponent anShi (card backs) -->
    <div class="zone-row">
      <div class="row-label">{{ expandedPlayer.name }}·暗室</div>
      <div class="zone-grid" :style="{ '--cols': expandedPlayer.anShi.length }">
        <div v-for="(_, i) in expandedPlayer.anShi" :key="i"
             :class="oppAnShiCellClass()"
             @click="onOpponentAnShiClick(expandedPlayer.id, i + 1)">
          <div class="card-back" />
        </div>
      </div>
    </div>

    <!-- Row 2: Opponent mingTang -->
    <div class="zone-row">
      <div class="row-label">{{ expandedPlayer.name }}·明堂</div>
      <div class="zone-grid" :style="{ '--cols': expandedPlayer.mingTang.length }">
        <div v-for="(card, i) in expandedPlayer.mingTang" :key="i" class="cell">
          <CardTile :card="card" />
        </div>
      </div>
    </div>

    <!-- Row 3: Talent pool -->
    <div class="zone-row talent-row">
      <div class="row-label">英才池</div>
      <div class="talent-line">
        <div v-for="stack in talent" :key="stack.col"
             :class="talentStackClass(stack.col)"
             @click="onTalentClick(stack.col)">
          <div class="talent-col-num">{{ stack.col }}</div>
          <CardTile :card="stack.cards[0]" :compact="true" />
          <div class="talent-count">×{{ stack.cards.length }}</div>
        </div>
      </div>
    </div>

    <!-- Row 4: My mingTang -->
    <div class="zone-row">
      <div class="row-label">我·明堂</div>
      <div class="zone-grid" :style="{ '--cols': me?.mingTang?.length ?? 5 }">
        <div v-for="(card, i) in me?.mingTang" :key="i"
             :class="ownCellClass('mingTang', i + 1)"
             @click="onOwnCellClick('mingTang', i + 1)">
          <CardTile :card="card" />
        </div>
      </div>
    </div>

    <!-- Row 5: My anShi -->
    <div class="zone-row">
      <div class="row-label">我·暗室</div>
      <div class="zone-grid" :style="{ '--cols': me?.anShi?.length ?? 5 }">
        <div v-for="(card, i) in me?.anShi" :key="i"
             :class="ownCellClass('anShi', i + 1)"
             @click="onOwnCellClick('anShi', i + 1)">
          <CardTile :card="card" />
        </div>
      </div>
    </div>
  </template>

  <!-- ── OVERVIEW STATE ── -->
  <template v-else>
    <!-- Opponent thumbnails -->
    <div class="opp-thumbnails" v-if="opponents.length">
      <div v-for="p in opponents" :key="p.id"
           class="opp-thumb"
           :class="{ 'thumb-current': p.id === store.currentPlayer?.id }"
           @click="emit('expand', p.id)"
           :title="`点击查看 ${p.name} 的手牌区`">
        <div class="thumb-header">
          <span class="thumb-name">{{ p.name }}</span>
          <span v-if="p.nation && p.nationDeclared" class="nation-badge">{{ p.nation }}</span>
        </div>
        <div class="thumb-envoy">使节 {{ p.freeEnvoys }}</div>
        <div class="thumb-preview">
          <div class="thumb-row-preview">
            <div v-for="(c, i) in p.mingTang" :key="i"
                 class="thumb-card" :class="c?.type ?? ''" :title="cardLabel(c)" />
          </div>
          <div class="thumb-row-preview">
            <div v-for="(_, i) in p.anShi" :key="i" class="thumb-card thumb-hidden" />
          </div>
        </div>
      </div>
    </div>

    <!-- Talent pool (always visible in overview) -->
    <div class="zone-row talent-row">
      <div class="row-label">英才池</div>
      <div class="talent-line">
        <div v-for="stack in talent" :key="stack.col"
             :class="talentStackClass(stack.col)"
             @click="onTalentClick(stack.col)">
          <div class="talent-col-num">{{ stack.col }}</div>
          <CardTile :card="stack.cards[0]" :compact="true" />
          <div class="talent-count">×{{ stack.cards.length }}</div>
        </div>
      </div>
    </div>

    <!-- My mingTang -->
    <div class="zone-row">
      <div class="row-label">我·明堂</div>
      <div class="zone-grid" :style="{ '--cols': me?.mingTang?.length ?? 5 }">
        <div v-for="(card, i) in me?.mingTang" :key="i"
             :class="ownCellClass('mingTang', i + 1)"
             @click="onOwnCellClick('mingTang', i + 1)">
          <CardTile :card="card" />
        </div>
      </div>
    </div>

    <!-- My anShi -->
    <div class="zone-row">
      <div class="row-label">我·暗室</div>
      <div class="zone-grid" :style="{ '--cols': me?.anShi?.length ?? 5 }">
        <div v-for="(card, i) in me?.anShi" :key="i"
             :class="ownCellClass('anShi', i + 1)"
             @click="onOwnCellClick('anShi', i + 1)">
          <CardTile :card="card" />
        </div>
      </div>
    </div>
  </template>

</div>
</template>
