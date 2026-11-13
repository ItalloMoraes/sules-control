import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/privacidade', component: () => import('@/pages/LegalPage.vue'), meta: { public: true, doc: 'privacidade' } },
    { path: '/termos', component: () => import('@/pages/LegalPage.vue'), meta: { public: true, doc: 'termos' } },
    { path: '/cookies', component: () => import('@/pages/LegalPage.vue'), meta: { public: true, doc: 'cookies' } },
    { path: '/creditos', component: () => import('@/pages/LegalPage.vue'), meta: { public: true, doc: 'creditos' } },
    { path: '/login', component: () => import('@/pages/LoginPage.vue'), meta: { public: true } },
    {
      path: '/', component: () => import('@/layouts/AppLayout.vue'),
      children: [
        { path: '', name: 'dashboard', component: () => import('@/pages/DashboardPage.vue'), meta: { title: 'Dashboard' } },
        { path: 'clientes', redirect: '/vendas' },
                { path: 'vendas', component: () => import('@/pages/SalesHubPage.vue'), meta: { title: 'Vendas' } },
                { path: 'vendas/:id', component: () => import('@/pages/SaleDetailPage.vue'), meta: { title: 'Venda' } },
        { path: 'comissoes', component: () => import('@/pages/CommissionsHubPage.vue'), meta: { title: 'Comissões' } },
                        { path: 'cancelamentos', redirect: { path: '/vendas', query: { tab: 'cancelamentos' } } },
                { path: 'conferencia', redirect: { path: '/relatorios', query: { tab: 'conferencia' } } },
                { path: 'conferencia/:id', component: () => import('@/pages/ReconciliationPage.vue'), meta: { title: 'Conferência' } },
        { path: 'calendario', redirect: { path: '/vendas', query: { tab: 'calendario' } } },
                { path: 'historico', redirect: '/vendas' },
                        { path: 'conversao', redirect: { path: '/desempenho', query: { tab: 'conversao' } } },
                        { path: 'notas', component: () => import('@/pages/NotesPage.vue'), meta: { title: 'Notas e mensagens' } },
        { path: 'desempenho', component: () => import('@/pages/PerformanceHubPage.vue'), meta: { title: 'Desempenho' } },
        { path: 'metas', redirect: { path: '/desempenho', query: { tab: 'metas' } } },
                        { path: 'projecoes', redirect: '/desempenho' },
                        { path: 'comparativos', redirect: { path: '/comissoes', query: { tab: 'comparativos' } } },
                        { path: 'relatorios', component: () => import('@/pages/ReportsHubPage.vue'), meta: { title: 'Relatórios e conferência' } },
                { path: 'configuracoes', component: () => import('@/pages/SettingsPage.vue'), meta: { title: 'Configurações' } },
      ],
    },
  ],
})

router.beforeEach(async to => {
  const auth = useAuth()
  if (!auth.ready) await auth.init()
  if (!to.meta.public && !auth.session) return '/login'
  if (to.path === '/login' && auth.session) return '/'
})
export default router
