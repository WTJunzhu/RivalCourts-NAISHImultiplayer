<script setup lang="ts">
import { sel } from '../composables/selection';
import { useGameStore } from '../store/game';
import CardTile from './CardTile.vue';

defineProps<{ stacks: any[] }>();
const store = useGameStore();

function onStackClick(col: number) {
  if (!store.isMyTurn) return;
  if (sel.mode === 'swap-a') { sel.swapA = col; sel.mode = 'swap-b'; }
  else if (sel.mode === 'swap-b') { sel.swapB = col; sel.mode = null; }
  else if (sel.mode === 'discard-a') { sel.discardA = col; sel.mode = 'discard-b'; }
  else if (sel.mode === 'discard-b') { sel.discardB = col; sel.mode = null; }
}

function stackClass(col: number): string {
  const cs: string[] = ['stack'];
  if (store.isMyTurn && (sel.mode === 'swap-a' || sel.mode === 'swap-b' || sel.mode === 'discard-a' || sel.mode === 'discard-b')) cs.push('clickable');
  if (sel.discardA === col || sel.discardB === col) cs.push('sel-discard');
  if (sel.swapA === col || sel.swapB === col) cs.push('sel-swap');
  return cs.join(' ');
}
</script>

<template>
<section class="talent">
  <div class="row-label">英才</div>
  <div class="line">
    <div v-for="stack in stacks" :key="stack.col"
         :class="stackClass(stack.col)"
         @click="onStackClick(stack.col)">
      <b>{{ stack.col }}</b>
      <CardTile :card="stack.cards[0]" />
      <span>×{{ stack.cards.length }}</span>
    </div>
  </div>
</section>
</template>
