<script setup lang="ts">
import { computed, ref } from 'vue';
import { HISTORY_LABELS, CARD_LABELS, TALENT_COUNTS } from '../../../shared/constants';
import PlayerBar from '../components/PlayerBar.vue';
import ActionBanner from '../components/ActionBanner.vue';
import EnvoyBoard from '../components/EnvoyBoard.vue';
import CenterZone from '../components/CenterZone.vue';
import GameSidebar from '../components/GameSidebar.vue';
import { useGameStore } from '../store/game';

const store = useGameStore();
const view = computed(() => store.view!);
const me = computed(() => store.me);

const anShiIdx = ref(0);
const historyIdx = ref(0);
const cardRefOpen = ref(false);

// Track which opponent is expanded (null = overview)
const expandedPlayerId = ref<string | null>(null);

// Auto-expand current active player when it's not my turn
const autoExpandId = computed(() => {
  if (!view.value || store.isMyTurn) return null;
  const cur = store.currentPlayer;
  if (!cur || cur.id === view.value.myPlayerId) return null;
  return cur.id;
});

const effectiveExpandedId = computed(() =>
  expandedPlayerId.value ?? autoExpandId.value);

function expandPlayer(id: string | null) {
  expandedPlayerId.value = id;
}

// Card reference counts for current player count
const cardRefEntries = computed(() => {
  if (!view.value) return [];
  const n = view.value.players.length;
  const counts = (TALENT_COUNTS as any)[n] ?? {};
  const entries = Object.entries(CARD_LABELS).map(([type, label]) => ({
    type, label, count: counts[type] ?? 0,
  })).filter(c => c.count > 0);
  // Add Wasteland separately (one per column)
  entries.push({ type: 'Wasteland', label: '荒地', count: view.value.gridSize });
  return entries;
});
</script>

<template>
<main v-if="store.view" class="game-layout">

  <!-- Passing phase overlay -->
  <Transition name="fade">
    <div v-if="view.phase === 'PASSING'" class="passing-overlay">
      <div class="passing-card">
        <h2>开局传牌</h2>
        <p>选择一张暗室牌传给下家。</p>
        <label>暗室位置（0 起）
          <input type="number" v-model.number="anShiIdx" min="0" :max="view.gridSize - 1">
        </label>
        <label v-if="view.options.historyCards">史书卡
          <select v-model.number="historyIdx">
            <option v-for="(h, i) in me?.historyCards" :key="i" :value="i">
              {{ HISTORY_LABELS[(h as any).type as keyof typeof HISTORY_LABELS] ?? (h as any).type }}
            </option>
          </select>
        </label>
        <button @click="store.submitPass(anShiIdx, historyIdx)">提交传牌</button>
      </div>
    </div>
  </Transition>

  <!-- A: Player bar -->
  <PlayerBar
    :players="view.players"
    :my-id="view.myPlayerId"
    :current-id="store.currentPlayer?.id ?? ''"
  />

  <!-- B: Action banner -->
  <ActionBanner v-if="view.phase === 'PLAYING' || view.phase === 'SCORING'" />

  <!-- C: Play area -->
  <div class="play-area">
    <!-- C-left: Envoy board -->
    <EnvoyBoard
      :players="view.players"
      :my-id="view.myPlayerId"
      :grid-size="view.gridSize"
    />

    <!-- C-mid: Center zone -->
    <CenterZone
      :players="view.players"
      :my-id="view.myPlayerId"
      :talent="view.talent"
      :expanded-id="effectiveExpandedId"
      @expand="expandPlayer"
    />

    <!-- C-right: Sidebar -->
    <GameSidebar
      :log="view.log"
      :discard-top="view.discardTop"
      :history-slots="(view as any).historySlots ?? []"
    />
  </div>

  <!-- D: Card reference bar -->
  <div class="card-ref-bar">
    <button class="card-ref-toggle" @click="cardRefOpen = !cardRefOpen">
      {{ cardRefOpen ? '▼ 收起卡牌参考' : '▲ 展开卡牌参考' }}
    </button>
    <span class="game-meta">
      {{ view.players.length }} 人局 · 第 {{ view.roundNumber }} 轮 · 已耗尽 {{ view.stacksExhausted }} 叠
    </span>
  </div>

  <!-- Card reference overlay (pull-up) -->
  <Transition name="slide-up">
    <div v-if="cardRefOpen" class="card-ref-overlay" @click.self="cardRefOpen = false">
      <div class="card-ref-panel">
        <div class="card-ref-header">
          <h3>卡牌参考 — {{ view.players.length }} 人局</h3>
          <button class="btn-sm" @click="cardRefOpen = false">✕ 关闭</button>
        </div>
        <div class="card-ref-grid">
          <div v-for="c in cardRefEntries" :key="c.type"
               class="card-ref-item" :class="c.type">
            <strong>{{ c.label }}</strong>
            <span class="cri-count">×{{ c.count }}</span>
            <small class="cri-type">{{ c.type }}</small>
          </div>
        </div>
      </div>
    </div>
  </Transition>

</main>
</template>
