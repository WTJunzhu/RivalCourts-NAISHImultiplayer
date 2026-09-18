<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  players: any[];
  myId: string;
  currentId: string;
}>();

const ordered = computed(() => {
  const me = props.players.find(p => p.id === props.myId);
  const others = props.players.filter(p => p.id !== props.myId);
  return me ? [me, ...others] : props.players;
});
</script>

<template>
<div class="player-bar">
  <div v-for="p in ordered" :key="p.id"
       class="player-chip"
       :class="{ 'chip-active': p.id === currentId, 'chip-self': p.id === myId }">
    <span class="chip-self-mark" v-if="p.id === myId">我</span>
    <span class="chip-name">{{ p.name }}</span>
    <span v-if="p.nation && p.nationDeclared" class="nation-badge">{{ p.nation }}</span>
    <span class="chip-envoys">使{{ p.freeEnvoys }}</span>
  </div>
</div>
</template>
