<script setup lang="ts">
import { computed } from 'vue';
import { SLOT_LIMITS } from '../../../shared/constants';
import { sel } from '../composables/selection';
import { useGameStore } from '../store/game';

const props = defineProps<{
  players: any[];
  myId: string;
  gridSize: number;
}>();

const store = useGameStore();
const limits = computed(() => SLOT_LIMITS[props.gridSize as keyof typeof SLOT_LIMITS]);
const me = computed(() => props.players.find(p => p.id === props.myId));
const isMyTurn = computed(() => store.isMyTurn);
const slots = computed(() => store.view?.slots ?? { swap: 0, discard: 0, envoy: 0, command: 0 });

const canInitSwap = computed(() =>
  (me.value?.freeEnvoys ?? 0) > 0 && slots.value.swap < limits.value.swap && sel.swapA === null);
const canInitDiscard = computed(() =>
  (me.value?.freeEnvoys ?? 0) > 0 && slots.value.discard < limits.value.discard && sel.discardA === null);
const canInitCommand = computed(() =>
  (me.value?.nationDeclared ?? false) && (me.value?.freeEnvoys ?? 0) > 0 && slots.value.command < limits.value.command);
const canInitEnvoy = computed(() =>
  (me.value?.nationDeclared ?? false) && (me.value?.freeEnvoys ?? 0) > 0 && slots.value.envoy < limits.value.envoy);

const showDiplomacy = computed(() =>
  store.view?.options.diplomacy && (store.view?.claimedNations.length ?? 0) > 0);

const SLOT_TYPES = ['swap', 'discard', 'command', 'envoy'] as const;
const SLOT_LABELS: Record<string, string> = {
  swap: '交换', discard: '弃牌', command: '号令', envoy: '出使',
};
const SLOT_TIPS: Record<string, string> = {
  swap: '将两叠英才的顶牌互换位置（消耗一枚使节）',
  discard: '弃置两叠英才各一张顶牌（消耗一枚使节）',
  command: '移动自己一张牌到目标玩家对应位置（需已宣国，消耗一枚使节）',
  envoy: '出使目标玩家（需已宣国且有外交选项，消耗一枚使节）',
};

function slotCircles(type: typeof SLOT_TYPES[number]) {
  const max = limits.value[type];
  const used = slots.value[type];
  return Array.from({ length: max }, (_, i) => i < used);
}

function canFill(type: typeof SLOT_TYPES[number]): boolean {
  if (!isMyTurn.value || sel.mode !== null) return false;
  if (type === 'swap') return canInitSwap.value;
  if (type === 'discard') return canInitDiscard.value;
  if (type === 'command') return canInitCommand.value;
  if (type === 'envoy') return canInitEnvoy.value && showDiplomacy.value;
  return false;
}

function isActiveMode(type: typeof SLOT_TYPES[number]): boolean {
  if (type === 'swap') return sel.mode === 'swap-a' || sel.mode === 'swap-b';
  if (type === 'discard') return sel.mode === 'discard-a' || sel.mode === 'discard-b';
  if (type === 'command') return sel.mode === 'command';
  if (type === 'envoy') return sel.mode === 'envoy';
  return false;
}

function circleClick(type: typeof SLOT_TYPES[number], filled: boolean) {
  if (filled || !isMyTurn.value) return;
  if (type === 'swap' && canInitSwap.value) sel.mode = 'swap-a';
  if (type === 'discard' && canInitDiscard.value) sel.mode = 'discard-a';
  if (type === 'command' && canInitCommand.value) {
    sel.mode = 'command';
    sel.commandZone = null;
    sel.commandCol = null;
  }
  if (type === 'envoy' && canInitEnvoy.value && showDiplomacy.value) sel.mode = 'envoy';
}
</script>

<template>
<aside class="envoy-sidebar">
  <div class="eb-title">使节板</div>

  <!-- Per-player envoy count -->
  <div class="eb-players">
    <div v-for="p in players" :key="p.id"
         class="eb-player-row"
         :class="{ 'eb-self': p.id === myId }">
      <span class="eb-pname">{{ p.name.slice(0, 3) }}</span>
      <span class="eb-penvoy">{{ p.freeEnvoys }}枚</span>
    </div>
  </div>

  <div class="eb-divider" />

  <!-- Slot rows -->
  <div v-for="type in SLOT_TYPES" :key="type"
       v-show="type !== 'envoy' || showDiplomacy"
       class="eb-slot-section">
    <div class="eb-slot-row" :title="SLOT_TIPS[type]">
      <span class="eb-slot-label">{{ SLOT_LABELS[type] }}</span>
      <div class="eb-circles">
        <div v-for="(filled, i) in slotCircles(type)" :key="i"
             class="slot-circle"
             :class="{
               filled,
               'can-fill': !filled && canFill(type),
               'active-slot': isActiveMode(type),
             }"
             @click="circleClick(type, filled)"
             :title="SLOT_TIPS[type]" />
      </div>
      <span class="eb-slot-count">{{ slots[type] }}/{{ limits[type] }}</span>
    </div>
  </div>
</aside>
</template>
