import type { RouteRecordRaw } from 'vue-router';
import TerminalView from '../views/TerminalView.vue';
import WaveformView from '../views/WaveformView.vue';
import PayloadView from '../views/PayloadView.vue';
import SettingsView from '../views/SettingsView.vue';

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Terminal',
    component: TerminalView,
    meta: {
      title: '终端',
      icon: 'Terminal',
    },
  },
  {
    path: '/waveform',
    name: 'Waveform',
    component: WaveformView,
    meta: {
      title: '波形',
      icon: 'Pulse',
    },
  },
  {
    path: '/payload',
    name: 'Payload',
    component: PayloadView,
    meta: {
      title: '命令预设',
      icon: 'Code',
    },
  },
  {
    path: '/settings',
    name: 'Settings',
    component: SettingsView,
    meta: {
      title: '设置',
      icon: 'Settings',
    },
  },
];
