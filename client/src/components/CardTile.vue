<script setup lang="ts">
import { CARD_LABELS } from '../../../shared/constants';
defineProps<{ card:any; compact?:boolean }>();
function label(card:any){ return card?.type==='HIDDEN'?'秘':CARD_LABELS[card?.type as keyof typeof CARD_LABELS] ?? '空'; }
</script>
<template><div class="card" :class="[card?.type, { compact, hidden: card?.type==='HIDDEN'}]"><strong>{{ label(card) }}</strong><small v-if="card?.type && card.type!=='HIDDEN'">{{ card.type }}</small></div></template>
