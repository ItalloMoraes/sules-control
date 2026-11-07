import type USelect from '@/components/USelect.vue'
import type UDate from '@/components/UDate.vue'
declare module 'vue' {
  interface GlobalComponents { USelect: typeof USelect; UDate: typeof UDate }
}
export {}
