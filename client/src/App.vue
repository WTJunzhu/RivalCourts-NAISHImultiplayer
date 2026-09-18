<script setup lang="ts">
import { onMounted } from 'vue';
import { useGameStore } from './store/game';
import Lobby from './views/Lobby.vue';
import Game from './views/Game.vue';
const store=useGameStore();
onMounted(()=>store.ensure());
</script>
<template><Lobby v-if="!store.view"/><Game v-else/></template>
