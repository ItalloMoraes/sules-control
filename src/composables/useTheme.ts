import { watchEffect, ref } from 'vue'

const KEY = 'sc-theme-v2'
const theme = ref<'dark' | 'light'>((localStorage.getItem(KEY) as 'dark' | 'light') || 'dark')

export function useTheme() {
  watchEffect(() => {
    document.documentElement.classList.toggle('dark', theme.value === 'dark')
    localStorage.setItem(KEY, theme.value)
  })
  return { theme, toggle: () => (theme.value = theme.value === 'dark' ? 'light' : 'dark') }
}
