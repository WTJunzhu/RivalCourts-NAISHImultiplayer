<script setup lang="ts">
import { ref } from 'vue';
import { useGameStore } from '../store/game';
const store=useGameStore();
const name=ref(localStorage.getItem('rival-name')||'玩家');
const roomCode=ref('');
const options=ref({historyCards:false,diplomacy:false,nationAbilities:true});
const toast=ref('');
function remember(){ localStorage.setItem('rival-name',name.value); }
function create(){ remember(); store.createRoom(name.value,options.value); }
function join(){ remember(); store.joinRoom(roomCode.value,name.value); }
function onHistoryCardsChange(e:Event){
  if((e.target as HTMLInputElement).checked){
    options.value.historyCards=false;
    toast.value='功能暂未开放，敬请期待';
    setTimeout(()=>toast.value='',3000);
  }
}
</script>
<template><main class="lobby"><section class="hero"><p class="eyebrow">Rival Courts</p><h1>纵横</h1><p>招贤、宣国、号令与称霸。当前版本是可本地联机的最小 MVP。</p></section><section class="join"><label>名号<input v-model="name" placeholder="你的名字"></label><div class="toggles"><label><input type="checkbox" :checked="options.historyCards" @change="onHistoryCardsChange"> 史书卡 <small>（暂未开放）</small></label><label><input type="checkbox" v-model="options.diplomacy"> 出使/开战</label><label><input type="checkbox" v-model="options.nationAbilities"> 七国能力</label></div><p v-if="toast" class="toast-msg">{{ toast }}</p><button @click="create">创建房间</button><div class="inline"><input v-model="roomCode" placeholder="房间码"><button @click="join">加入</button></div><p>连接：{{ store.status }}</p></section><section v-if="store.room" class="room"><h2>房间 {{ store.room.code }}</h2><p>人数 {{ store.room.players.length }} / 7</p><ol><li v-for="p in store.room.players" :key="p.id">{{ p.name }} <b v-if="p.id===store.room.hostId">房主</b></li></ol><button :disabled="store.room.players.length<2" @click="store.startGame()">开始游戏</button></section></main></template>
