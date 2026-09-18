<script setup lang="ts">
import { CARD_LABELS, HISTORY_LABELS } from '../../../shared/constants';

const props = defineProps<{
  log: any[];
  discardTop?: any;
  historySlots?: any[];
}>();

function cardLabel(card: any): string {
  if (!card) return '—';
  return CARD_LABELS[card.type as keyof typeof CARD_LABELS] ?? card.type ?? '?';
}

function historyLabel(h: any): string {
  if (!h?.type) return '—';
  return HISTORY_LABELS[h.type as keyof typeof HISTORY_LABELS] ?? h.type;
}

function logTime(at: number): string {
  return new Date(at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
</script>

<template>
<aside class="game-sidebar">
  <div class="sidebar-title">史官记录</div>
  <div class="sidebar-log">
    <p v-if="!log.length" class="log-empty">暂无记录</p>
    <p v-for="entry in [...log].reverse()" :key="entry.id" class="log-entry">
      <span class="log-time">{{ logTime(entry.at) }}</span>
      {{ entry.text }}
    </p>
  </div>

  <div class="sidebar-bottom">
    <div class="sb-discard">
      <div class="sb-section-label">弃牌堆</div>
      <div class="card sb-card" :class="discardTop?.type ?? 'Wasteland'">
        <strong>{{ cardLabel(discardTop) }}</strong>
        <small>{{ discardTop?.type ?? '—' }}</small>
      </div>
    </div>
    <div class="sb-history">
      <div class="sb-section-label">史书卡槽</div>
      <div class="history-slots">
        <div v-if="!historySlots?.length" class="card sb-card-wide">
          <small>暂无</small>
        </div>
        <div v-for="(h, i) in historySlots" :key="i"
             class="card sb-card-wide"
             :class="{ 'history-used': h?.used }">
          <strong>{{ historyLabel(h) }}</strong>
        </div>
      </div>
    </div>
  </div>
</aside>
</template>
