<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{ value: string }>()
const map: Record<string, [string, string]> = {
  pendente: ['Pendente', 'bg-warn/15 text-warn'],
  emitida: ['Emitida', 'bg-pos/15 text-pos'],
  cancelada: ['Cancelada', 'bg-neg/15 text-neg'],
  parcialmente_recebido: ['Parcialmente recebido', 'bg-info/15 text-info'],
  recebido: ['Recebido', 'bg-pos/15 text-pos'],
  efetivado: ['Efetivado', 'bg-pos/15 text-pos'],
  cancelado: ['Cancelado', 'bg-mute/20 text-mute'],
  conferido: ['Conferido', 'bg-pos/15 text-pos'],
  divergencia: ['Divergência', 'bg-neg/15 text-neg'],
  nao_cadastrado: ['Não cadastrado', 'bg-warn/15 text-warn'],
  nao_consta_no_relatorio: ['Não consta no relatório', 'bg-warn/15 text-warn'],
  movimentacao_especial: ['Movimentação especial', 'bg-info/15 text-info'],
  duplicado: ['Duplicado', 'bg-mute/20 text-mute'],
  digital_suhai: ['Digital Suhai', 'bg-info/15 text-info'],
  venda_propria: ['Venda própria', 'bg-gold/15 text-gold'],
}
const v = computed(() => map[props.value] ?? [props.value, 'bg-raise text-mute'])
</script>
<template><span class="badge" :class="v[1]">{{ v[0] }}</span></template>
