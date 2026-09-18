<script setup lang="ts">
defineProps<{ players:any[]; currentId?:string; scores?:Record<string,number> }>();
</script>
<template><aside class="status"><h2>诸侯</h2><div v-for="p in players" :key="p.id" class="lord" :class="{current:p.id===currentId}"><b>{{ p.name }}</b><span>{{ p.nation ?? '未宣国' }}</span><span>使节 {{ p.freeEnvoys }}</span><span v-if="scores">{{ scores[p.id] }} 分</span></div></aside></template>
