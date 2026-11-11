import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import USelect from './components/USelect.vue'
import UDate from './components/UDate.vue'
import UDateRange from './components/UDateRange.vue'
import MoneyInput from './components/MoneyInput.vue'
import { vReveal } from './motion/reveal'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import './style.css'

createApp(App).use(createPinia()).use(router).directive('reveal', vReveal).component('USelect', USelect).component('UDate', UDate).component('UDateRange', UDateRange).component('MoneyInput', MoneyInput).mount('#app')

// Desliga as sugestões de preenchimento do navegador (textos digitados antes) em todos os campos,
// exceto onde o autocomplete foi definido de propósito (e-mail e senha do login).
const noSuggest = () => document.querySelectorAll('input:not([autocomplete]):not([type="file"]), textarea:not([autocomplete])').forEach(el => el.setAttribute('autocomplete', 'off'))
new MutationObserver(noSuggest).observe(document.body, { childList: true, subtree: true })
noSuggest()
