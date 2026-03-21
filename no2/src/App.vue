<script setup lang="ts">
import { ref, onMounted } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { NSelect, NButton, NSpace, NConfigProvider, darkTheme } from 'naive-ui'

const portOptions = ref<{ label: string; value: string }[]>([]);
const selectedPort = ref(null);

// 调用 Rust 后端获取串口列表
const refreshPorts = async () => {
  const ports: string[] = await invoke("get_available_ports");
  portOptions.value = ports.map(p => ({ label: p, value: p }));
};

onMounted(refreshPorts);
</script>

<template>
  <n-config-provider :theme="darkTheme">
    <div class="container" style="padding: 20px; background: #18181c; height: 100vh;">
      <n-space vertical>
        <h3 style="color: #fff; margin-bottom: 10px;">串口设置</h3>
        <n-space>
          <n-select
            v-model:value="selectedPort"
            :options="portOptions"
            placeholder="选择串口"
            style="width: 200px"
          />
          <n-button @click="refreshPorts" type="primary" ghost>
            刷新设备
          </n-button>
        </n-space>
      </n-space>
    </div>
  </n-config-provider>
</template>

<style>
body { margin: 0; font-family: v-sans, system-ui, -apple-system, sans-serif; }
</style>