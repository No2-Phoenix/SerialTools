# GreenSerial

一款现代化的串口助手，基于 Tauri + Vue3 + Rust 构建，提供流畅的用户体验和强大的串口通信功能。

## 功能特点

### 核心功能

- **串口连接管理** - 支持自动扫描、连接、断开串口设备
- **数据收发** - 支持 ASCII 和 HEX 格式发送与接收
- **定时发送** - 可配置的自动发送功能
- **数据日志** - 实时显示收发数据，支持导出

### 特色功能

- **多主题支持** - 深色、浅色、樱花粉、克莱因蓝、梦幻紫
- **实时波形** - 波形数据可视化显示
- **页面保持** - 切换页面时保持串口连接
- **错误恢复** - 连接中断后自动重连

## 技术栈

**前端**

- Vue 3.4+ (Composition API)
- TypeScript 5.3+
- Pinia (状态管理)
- Naive UI (组件库)
- Lucide Icons (图标)
- Vue Router 4

**后端**

- Rust
- Tauri 2.0
- Tokio (异步运行时)
- serialport (串口通信)
- tracing (日志)

## 开发环境

### 前置要求

- Node.js 18+
- Rust 1.70+
- Windows 10/11

### 安装依赖

```bash
# 安装前端依赖
npm install

# 安装 Rust 依赖 (在 src-tauri 目录下)
cd src-tauri
cargo build
```

### 开发模式

```bash
# 启动前端开发服务器
npm run dev

# 启动 Tauri 开发模式
npm run tauri dev
```

### 安装（用户）

注意：本软件仅支持 Windows 10 / Windows 11。

1. 本地构建后生成的 NSIS 安装程序位于仓库内的：

	`src-tauri/target/release/bundle/nsis/`

	例如（相对仓库根）：

	`src-tauri/target/release/bundle/nsis/SerialTools-1.0.0-setup.exe`

2. 运行下载或构建出的 `.exe` 安装程序，按向导完成安装。

3. 推荐在 GitHub Releases 发布正式安装包，仓库中可保留 `releases/` 作为占位或快速访问，但不建议将实际大型二进制直接长期托管在源码仓库中。

已包含的安装程序（仓库内）：

`releases/GreenSerial_1.0.0_x64-setup.exe` （相对仓库根，Windows 安装程序）


如果需要从源码构建并生成安装包（开发者）：

```bash
# 安装前端依赖并构建
npm install
npm run build

# 在 src-tauri 目录下构建 Tauri 发布包并生成 NSIS 安装程序
cd src-tauri
cargo build --release
# 或者使用 tauri 的封装命令（根据项目脚本）
npm run tauri build
```

构建完成后，NSIS 安装程序位于上文所述的 `src-tauri/target/release/bundle/nsis/` 目录。


### 构建发布

```bash
# 构建生产版本
npm run build
npm run tauri build
```

## 项目结构

```
SerialTools/
├── src/                      # Vue 前端源码
│   ├── components/            # Vue 组件
│   │   ├── ConnectionPanel.vue    # 串口连接面板
│   │   ├── LogPanel.vue          # 数据日志面板
│   │   ├── SendPanel.vue          # 数据发送面板
│   │   └── WaveformPanel.vue      # 波形显示面板
│   ├── stores/                # Pinia 状态管理
│   │   ├── serialConnection.ts    # 串口连接状态
│   │   ├── theme.ts               # 主题状态
│   │   └── device.ts              # 设备状态
│   ├── views/                 # 页面视图
│   │   ├── TerminalView.vue       # 终端页面
│   │   ├── WaveformView.vue       # 波形页面
│   │   └── SettingsView.vue       # 设置页面
│   └── styles/                # 样式文件
│       └── themes.css             # 主题样式
├── src-tauri/                 # Rust 后端源码
│   └── src/
│       ├── main.rs               # 主入口
│       ├── serial.rs              # 串口通信
│       └── waveform.rs            # 波形处理
└── dist/                      # 构建输出
```

## 使用说明

### 连接串口

1. 点击「刷新」按钮扫描可用串口
2. 从下拉列表选择目标串口
3. 配置波特率、数据位、校验位、停止位
4. 点击「连接」按钮建立连接

### 发送数据

1. 在输入框输入要发送的数据
2. 选择发送格式（ASCII 或 HEX）
3. 可选：启用定时发送，设置发送间隔
4. 点击「发送」或等待定时发送

### 查看日志

- 收发数据实时显示在日志区域
- 点击「清空」按钮清除日志
- 点击「导出」按钮导出日志数据
- 点击「暂停/继续」按钮控制数据接收

## 配置说明

### 串口参数

| 参数  | 可选值                      |
| --- | ------------------------ |
| 波特率 | 300 \~ 2000000           |
| 数据位 | 5, 6, 7, 8               |
| 校验位 | None, Odd, Even          |
| 停止位 | 1, 1.5, 2                |
| 流控制 | None, Software, Hardware |

### 定时发送

- 间隔范围：100ms \~ 60000ms
- 启用后按设定间隔自动发送数据

## 主题预览

| 主题             | 预览            |
| -------------- | ------------- |
| 深色专业 (Dark)    | 深蓝黑色调，适合长时间使用 |
| 浅色清爽 (Light)   | 浅灰白色调，简洁明亮    |
| 樱花粉 (Sakura)   | 柔和粉色系，少女风格    |
| 克莱因蓝 (Arctic)  | 冷色调科技感        |
| 梦幻紫 (Lavender) | 薰衣草紫，优雅神秘     |

## 更新日志

### v1.0.0 (2024)

- 初始版本发布
- 基础串口通信功能
- 多主题支持
- 数据日志与导出
- 定时发送功能
- 波形显示功能（开发中）

## 已知问题

- 先连接串口再开启设备可能无法接收数据，建议先开启设备再连接
- 波形功能仍在完善中

## 贡献指南

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License
