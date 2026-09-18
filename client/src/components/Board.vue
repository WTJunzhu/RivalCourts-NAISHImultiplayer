<script setup lang="ts">
import { computed } from 'vue';
import type { Zone } from '../../../shared/types';
import { sel } from '../composables/selection';
import { useGameStore } from '../store/game';
import CardTile from './CardTile.vue';

const props = defineProps<{ player: any; meId: string; active: boolean }>();
const store = useGameStore();
const isMe = computed(() => props.player.id === props.meId);
const isMyTurn = computed(() => store.isMyTurn);
const cols = computed(() => props.player.mingTang.length);

function onCellClick(zone: Zone, col: number) {
  if (!isMyTurn.value) return;
  if (isMe.value) handleOwn(zone, col);
  else if (zone === 'anShi' && sel.mode === 'peek') {
    store.action({ type: 'PEEK', targetPlayerId: props.player.id, anShiCol: col });
    sel.mode = null;
  }
}

function handleOwn(zone: Zone, col: number) {
  if (sel.mode === 'command') { sel.commandZone = zone; sel.commandCol = col; return; }
  // Toggle pending recruit on same cell; set new one otherwise
  if (sel.pendingRecruit?.zone === zone && sel.pendingRecruit?.col === col) {
    sel.pendingRecruit = null;
  } else {
    sel.pendingRecruit = { zone, col };
  }
}

function extraClass(zone: Zone, col: number, own: boolean): string {
  const cs: string[] = [];
  if (own && isMyTurn.value) cs.push('clickable');
  if (!own && zone === 'anShi' && sel.mode === 'peek' && isMyTurn.value) cs.push('clickable', 'peek-hint');
  if (own) {
    if (sel.pendingRecruit?.zone === zone && sel.pendingRecruit?.col === col) cs.push('sel-target');
    if (sel.commandZone === zone && sel.commandCol === col) cs.push('sel-command');
  }
  return cs.join(' ');
}
</script>

<template>
<article class="board" :class="{ active, mine: isMe }" :style="{ '--cols': cols }">
  <header>
    <h3>{{ player.name }}<span v-if="player.nation && player.nationDeclared" class="nation-badge">{{ player.nation }}</span></h3>
    <span class="envoy-count">使节 {{ player.freeEnvoys }}</span>
  </header>
  <div class="row-label">明堂</div>
  <div class="grid">
    <div v-for="(card, i) in player.mingTang" :key="i"
         class="cell" :class="extraClass('mingTang', i+1, isMe)"
         @click="onCellClick('mingTang', i+1)">
      <CardTile :card="card" />
    </div>
  </div>
  <div class="row-label">暗室</div>
  <div class="grid">
    <div v-for="(card, i) in player.anShi" :key="i"
         class="cell" :class="extraClass('anShi', i+1, isMe)"
         @click="onCellClick('anShi', i+1)">
      <CardTile v-if="isMe" :card="card" />
      <div v-else class="card-back"></div>
    </div>
  </div>
</article>
</template>
