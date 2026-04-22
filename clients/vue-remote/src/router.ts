/**
 * Маршрутизація.
 *
 * Три шляхи:
 *   /                  — порожній стан (нічого не обрано). При першому
 *                        заході і відсутності креденшлів редірект на
 *                        /connect; якщо креденшли є, App.vue рендерить
 *                        empty-state + drawer.
 *   /connect           — ConnectPanel (URL + токен + preferences).
 *   /chat/:sessionId   — чат конкретної сесії. App.vue зчитує param і
 *                        викликає selectSession(sessionId) після того як
 *                        WS відкрився.
 *
 * Використовуємо history-mode (createWebHistory) для чистих URL —
 * SPA-fallback реалізовано у daemonServer.ts (невідомі шляхи повертають
 * index.html).
 */

import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: { template: '<div />' } },
  { path: '/connect', name: 'connect', component: { template: '<div />' } },
  {
    path: '/chat/:sessionId',
    name: 'chat',
    component: { template: '<div />' },
    props: true,
  },
  // Catch-all — невідомі шляхи → на корінь.
  { path: '/:pathMatch(.*)*', redirect: { name: 'home' } },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})
