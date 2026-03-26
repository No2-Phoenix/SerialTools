import type { RouteRecordRaw } from 'vue-router';

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Terminal',
    component: () => import('../views/TerminalView.vue'),
    meta: {
      title: '终端',
      icon: 'Terminal',
    },
  },
  {
    path: '/waveform',
    name: 'Waveform',
    component: () => import('../views/WaveformView.vue'),
    meta: {
      title: '波形',
      icon: 'Pulse',
    },
  },
  {
    path: '/payload',
    name: 'Payload',
    component: () => import('../views/PayloadView.vue'),
    meta: {
      title: '命令预设',
      icon: 'Code',
    },
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('../views/SettingsView.vue'),
    meta: {
      title: '设置',
      icon: 'Settings',
    },
  },
];
