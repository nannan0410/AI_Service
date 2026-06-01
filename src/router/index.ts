import { createRouter, createWebHistory } from 'vue-router'
import { setupRouterGuards } from './guards'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/pages/login/LoginPage.vue'),
      meta: { public: true, title: '登录' },
    },
    {
      path: '/',
      name: 'home',
      component: () => import('@/pages/home/HomePage.vue'),
      meta: { title: '首页' },
    },
    {
      path: '/chat',
      name: 'chat',
      component: () => import('@/pages/chat/ChatPage.vue'),
      meta: { title: 'AI 助手' },
    },
    {
      path: '/orders',
      name: 'orders',
      component: () => import('@/pages/orders/OrdersPage.vue'),
      meta: { title: '我的订单' },
    },
    {
      path: '/coupon',
      name: 'coupon',
      component: () => import('@/pages/coupon/CouponPage.vue'),
      meta: { title: '优惠券' },
    },
    {
      path: '/parking',
      name: 'parking',
      component: () => import('@/pages/parking/ParkingPage.vue'),
      meta: { title: '停车缴费' },
    },
    {
      path: '/invoice',
      name: 'invoice',
      component: () => import('@/pages/invoice/InvoicePage.vue'),
      meta: { title: '发票申请' },
    },
    {
      path: '/invoice/external',
      name: 'invoice-external',
      component: () => import('@/pages/invoice/InvoiceExternalPage.vue'),
      meta: { title: '开票' },
    },
    {
      path: '/activity',
      name: 'activity',
      component: () => import('@/pages/activity/ActivityPage.vue'),
      meta: { title: '园区活动' },
    },
    {
      path: '/receipt',
      name: 'receipt',
      component: () => import('@/pages/receipt/ReceiptPage.vue'),
      meta: { title: '小票上传' },
    },
    {
      path: '/admin/ui',
      name: 'admin-ui',
      component: () => import('@/pages/admin/AdminUiPage.vue'),
      meta: { public: true, title: '助手 UI 配置' },
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('@/pages/profile/ProfilePage.vue'),
      meta: { title: '我的' },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

setupRouterGuards(router)

export default router
