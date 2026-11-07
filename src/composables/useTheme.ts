import { watchEffect, ref } from 'vue'

const theme = ref<'dark' | 'light'>((localStorage.getItem('sc-theme') as 'dark' | 'light') || 'light')

export function useTheme() {
  watchEffect(() => {
    document.documentElement.classList.toggle('dark', theme.value === 'dark')
    localStorage.setItem('sc-theme', theme.value)
  })
  return { theme, toggle: () => (theme.value = theme.value === 'dark' ? 'light' : 'dark') }
}
