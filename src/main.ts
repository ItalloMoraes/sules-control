import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import USelect from './components/USelect.vue'
import UDate from './components/UDate.vue'
import { vReveal } from './motion/reveal'
import './style.css'

createApp(App).use(createPinia()).use(router).directive('reveal', vReveal).component('USelect', USelect).component('UDate', UDate).mount('#app')
