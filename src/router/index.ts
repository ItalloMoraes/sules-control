import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: () => import('@/pages/LoginPage.vue'), meta: { public: true } },
    {
      path: '/', component: () => import('@/layouts/AppLayout.vue'),
      children: [
        { path: '', name: 'dashboard', component: () => import('@/pages/DashboardPage.vue'), meta: { title: 'Dashboard' } },
        { path: 'clientes', component: () => import('@/pages/HistoryPage.vue'), meta: { title: 'Clientes' } },
        { path: 'vendas', component: () => import('@/pages/SalesPage.vue'), meta: { title: 'Vendas' } },
        { path: 'vendas/:id', component: () => import('@/pages/SaleDetailPage.vue'), meta: { title: 'Venda' } },
        { path: 'comissoes', component: () => import('@/pages/CommissionsPage.vue'), meta: { title: 'Comissões e recebimentos' } },
        { path: 'cancelamentos', component: () => import('@/pages/CancellationsPage.vue'), meta: { title: 'Cancelamentos e estornos' } },
        { path: 'conferencia', component: () => import('@/pages/ReconciliationListPage.vue'), meta: { title: 'Conferência mensal' } },
        { path: 'conferencia/:id', component: () => import('@/pages/ReconciliationPage.vue'), meta: { title: 'Conferência' } },
        { path: 'calendario', component: () => import('@/pages/CalendarPage.vue'), meta: { title: 'Calendário' } },
        { path: 'historico', redirect: '/clientes' },
                { path: 'conversao', redirect: '/metas' },
                { path: 'notas', component: () => import('@/pages/NotesPage.vue'), meta: { title: 'Notas e mensagens' } },
        { path: 'metas', component: () => import('@/pages/GoalsHubPage.vue'), meta: { title: 'Metas e conversão' } },
                { path: 'projecoes', component: () => import('@/pages/ForecastHubPage.vue'), meta: { title: 'Projeções e comparativos' } },
                { path: 'comparativos', redirect: '/projecoes' },
                { path: 'relatorios', component: () => import('@/pages/ReportsPage.vue'), meta: { title: 'Relatórios' } },
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
