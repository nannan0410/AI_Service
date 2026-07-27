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
      path: '/invoice/batch',
      name: 'invoice-batch',
      component: () => import('@/pages/invoice/InvoiceBatchPage.vue'),
      meta: { title: '批量开发票' },
    },
    {
      path: '/invoice/external',
      name: 'invoice-external',
      component: () => import('@/pages/invoice/InvoiceExternalPage.vue'),
      meta: { title: '开票' },
    },
    {
      path: '/review',
      name: 'review',
      component: () => import('@/pages/review/ReviewPage.vue'),
      meta: { title: '服务点评' },
    },
    {
      path: '/checkin',
      name: 'checkin',
      component: () => import('@/pages/checkin/CheckinPage.vue'),
      meta: { title: '园区打卡' },
    },
    {
      path: '/queue/take',
      name: 'queue-take',
      component: () => import('@/pages/queue/QueueTakePage.vue'),
      meta: { title: '免费虚拟排队' },
    },
    {
      path: '/queue/pay',
      name: 'queue-pay',
      component: () => import('@/pages/queue/QueuePayPage.vue'),
      meta: { title: '快速排队' },
    },
    {
      path: '/activity',
      name: 'activity',
      component: () => import('@/pages/activity/ActivityPage.vue'),
      meta: { title: '园区活动' },
    },
    {
      path: '/map',
      name: 'map',
      component: () => import('@/pages/map/MapPage.vue'),
      meta: { title: '园区地图' },
    },
    {
      path: '/receipt',
      name: 'receipt',
      component: () => import('@/pages/receipt/ReceiptPage.vue'),
      meta: { title: '小票上传' },
    },
    {
      path: '/order/submit',
      name: 'order-submit',
      component: () => import('@/pages/order/OrderSubmitPage.vue'),
      meta: { title: '提交订单' },
    },
    {
      path: '/tickets',
      name: 'tickets',
      component: () => import('@/pages/tickets/TicketsPage.vue'),
      meta: { title: '购票列表' },
    },
    {
      path: '/config',
      component: () => import('@/pages/config/ConfigLayout.vue'),
      meta: { public: true, title: '后台配置' },
      children: [
        { path: '', redirect: '/config/ui' },
        {
          path: 'ui',
          name: 'config-ui',
          component: () => import('@/pages/admin/AdminUiPage.vue'),
          meta: { public: true, title: '助手 UI 配置' },
        },
        {
          path: 'business',
          name: 'config-business',
          component: () => import('@/pages/admin/AdminBusinessPage.vue'),
          meta: { public: true, title: '业务场景配置' },
        },
        {
          path: 'data',
          name: 'config-data',
          component: () => import('@/pages/admin/AdminDataPage.vue'),
          meta: { public: true, title: '数据与接口' },
        },
        {
          path: 'route-check',
          name: 'config-route-check',
          component: () => import('@/pages/admin/AdminRouteConflictPage.vue'),
          meta: { public: true, title: '路由冲突检查' },
        },
      ],
    },
    { path: '/admin/ui', redirect: '/config/ui' },
    { path: '/admin/business', redirect: '/config/business' },
    { path: '/admin/data', redirect: '/config/data' },
    { path: '/admin/route-check', redirect: '/config/route-check' },
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
