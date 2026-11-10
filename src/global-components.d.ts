import type USelect from '@/components/USelect.vue'
import type UDate from '@/components/UDate.vue'
import type UDateRange from '@/components/UDateRange.vue'
declare module 'vue' {
  interface GlobalComponents { USelect: typeof USelect; UDate: typeof UDate; UDateRange: typeof UDateRange }
}
export {}
