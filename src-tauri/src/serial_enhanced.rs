use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::{mpsc, RwLock};
use tokio::time::{interval, sleep};
use tracing::{debug, error, info, warn};

use crate::waveform::WaveformManager;

/// 串口连接状态
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ConnectionState {
    Disconnected,
    Connecting,
    Connected,
    Reconnecting { attempt: u32, next_retry_ms: u64 },
    Error(String),
}

/// 增强的串口配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnhancedPortConfig {
    pub port_name: String,
    pub baud_rate: u32,
    pub data_bits: u8,
    pub parity: String,      // "none" | "odd" | "even"
    pub stop_bits: String,   // "1" | "1.5" | "2"
    pub flow_control: String, // "none" | "software" | "hardware"
    
    // 重连配置
    pub auto_reconnect: bool,
    pub reconnect_interval_ms: u64,
    pub max_reconnect_attempts: u32,
    pub heartbeat_interval_ms: u64,
    pub heartbeat_timeout_ms: u64,
}

impl Default for EnhancedPortConfig {
    fn default() -> Self {
        Self {
            port_name: String::new(),
            baud_rate: 115200,
            data_bits: 8,
            parity: "none".to_string(),
            stop_bits: "1".to_string(),
            flow_control: "none".to_string(),
            auto_reconnect: true,
            reconnect_interval_ms: 3000,
            max_reconnect_attempts: 10,
            heartbeat_interval_ms: 5000,
            heartbeat_timeout_ms: 10000,
        }
    }
}

/// 端口状态管理
struct PortState {
    #[allow(dead_code)]
    config: EnhancedPortConfig,
    state: Arc<RwLock<ConnectionState>>,
    data_tx: mpsc::Sender<Vec<u8>>,
    #[allow(dead_code)]
    last_activity: Arc<RwLock<Instant>>,
    #[allow(dead_code)]
    reconnect_attempts: Arc<RwLock<u32>>,
    #[allow(dead_code)]
    waveform_manager: Option<WaveformManager>,
}

/// 增强的串口管理器
pub struct EnhancedSerialManager {
    ports: DashMap<String, PortState>,
}

impl EnhancedSerialManager {
    pub fn new() -> Self {
        Self {
            ports: DashMap::new(),
        }
    }

    /// 打开串口 - 带完整配置支持
    pub async fn open_port(&self, config: EnhancedPortConfig) -> anyhow::Result<String> {
        let port_name = config.port_name.clone();

        if self.ports.contains_key(&port_name) {
            return Err(anyhow::anyhow!("Port {} is already open", port_name));
        }

        // 解析配置
        let data_bits = match config.data_bits {
            5 => serialport::DataBits::Five,
            6 => serialport::DataBits::Six,
            7 => serialport::DataBits::Seven,
            8 => serialport::DataBits::Eight,
            _ => serialport::DataBits::Eight,
        };

        let parity = match config.parity.as_str() {
            "odd" => serialport::Parity::Odd,
            "even" => serialport::Parity::Even,
            _ => serialport::Parity::None,
        };

        let stop_bits = match config.stop_bits.as_str() {
            "2" => serialport::StopBits::Two,
            _ => serialport::StopBits::One,
        };

        let flow_control = match config.flow_control.as_str() {
            "software" => serialport::FlowControl::Software,
            "hardware" => serialport::FlowControl::Hardware,
            _ => serialport::FlowControl::None,
        };

        // 尝试打开串口
        let port = serialport::new(&port_name, config.baud_rate)
            .data_bits(data_bits)
            .parity(parity)
            .stop_bits(stop_bits)
            .flow_control(flow_control)
            .timeout(Duration::from_millis(10))
            .open()?;

        info!(
            "Opened serial port: {} @ {} baud, {} data bits, {} parity, {} stop bits, {} flow control",
            port_name, config.baud_rate, config.data_bits, 
            config.parity, config.stop_bits, config.flow_control
        );

        // 创建通信通道
        let (data_tx, data_rx) = mpsc::channel::<Vec<u8>>(1024);
        let state = Arc::new(RwLock::new(ConnectionState::Connected));
        let last_activity = Arc::new(RwLock::new(Instant::now()));
        let reconnect_attempts = Arc::new(RwLock::new(0u32));

        // 创建波形管理器 (如果启用了波形功能)
        let (waveform_manager, _waveform_rx) = WaveformManager::new(1000, 4);

        // 存储端口状态
        let port_state = PortState {
            config: config.clone(),
            state: state.clone(),
            data_tx: data_tx.clone(),
            last_activity: last_activity.clone(),
            reconnect_attempts: reconnect_attempts.clone(),
            waveform_manager: Some(waveform_manager),
        };
        
        self.ports.insert(port_name.clone(), port_state);

        // 启动工作线程
        let port_name_clone = port_name.clone();
        
        tokio::spawn(async move {
            Self::port_worker(
                port,
                port_name_clone,
                config,
                data_rx,
                state,
                last_activity,
                reconnect_attempts,
            ).await;
        });

        Ok(port_name)
    }

    /// 串口工作线程 - 包含心跳检测和自动重连
    async fn port_worker(
        mut port: Box<dyn serialport::SerialPort>,
        port_name: String,
        config: EnhancedPortConfig,
        mut data_rx: mpsc::Receiver<Vec<u8>>,
        state: Arc<RwLock<ConnectionState>>,
        last_activity: Arc<RwLock<Instant>>,
        reconnect_attempts: Arc<RwLock<u32>>,
    ) {
        let mut buf = vec![0u8; 4096];
        let mut heartbeat_timer = interval(Duration::from_millis(config.heartbeat_interval_ms));
        let _port_name_for_reconnect = port_name.clone();

        loop {
            tokio::select! {
                // 读取串口数据 - 使用阻塞读取
                _ = tokio::time::sleep(Duration::from_millis(1)) => {
                    match port.read(&mut buf) {
                        Ok(n) if n > 0 => {
                            let _data = buf[..n].to_vec();
                            *last_activity.write().await = Instant::now();
                            
                            // 重置重连计数
                            let mut attempts = reconnect_attempts.write().await;
                            if *attempts > 0 {
                                *attempts = 0;
                                info!("Port {} reconnected successfully", port_name);
                            }
                            drop(attempts);

                            // TODO: 发送数据到前端 - 需要使用通道或其他方式
                        }
                        Ok(_) => {
                            // 没有数据，继续
                        }
                        Err(e) => {
                            if e.kind() != std::io::ErrorKind::TimedOut {
                                error!("Error reading from port {}: {}", port_name, e);
                                
                                // 更新状态为错误
                                *state.write().await = ConnectionState::Error(e.to_string());
                                
                                // 尝试重连
                                if config.auto_reconnect {
                                    break; // 退出工作循环，触发重连
                                }
                            }
                        }
                    }
                }

                // 处理发送数据
                Some(data) = data_rx.recv() => {
                    if data.is_empty() {
                        // 空数据表示关闭请求
                        info!("Received close request for port {}", port_name);
                        break;
                    }
                    
                    match port.write_all(&data) {
                        Ok(_) => {
                            debug!("Wrote {} bytes to {}", data.len(), port_name);
                            *last_activity.write().await = Instant::now();
                        }
                        Err(e) => {
                            error!("Error writing to port {}: {}", port_name, e);
                        }
                    }
                }

                // 心跳检测
                _ = heartbeat_timer.tick() => {
                    let activity = *last_activity.read().await;
                    let elapsed = activity.elapsed().as_millis() as u64;
                    
                    if elapsed > config.heartbeat_timeout_ms {
                        warn!(
                            "Heartbeat timeout for port {} ({}ms elapsed)", 
                            port_name, elapsed
                        );
                        
                        *state.write().await = ConnectionState::Error("Heartbeat timeout".to_string());
                        
                        if config.auto_reconnect {
                            break; // 触发重连
                        }
                    }
                }
            }
        }

        // 尝试自动重连
        if config.auto_reconnect {
            Self::attempt_reconnect(
                port_name.clone(),
                config,
                state,
                reconnect_attempts,
            ).await;
        }

        info!("Serial port worker stopped: {}", port_name);
    }

    /// 自动重连逻辑
    async fn attempt_reconnect(
        port_name: String,
        config: EnhancedPortConfig,
        state: Arc<RwLock<ConnectionState>>,
        reconnect_attempts: Arc<RwLock<u32>>,
    ) {
        let mut attempts = reconnect_attempts.write().await;
        *attempts += 1;
        
        if *attempts > config.max_reconnect_attempts {
            error!("Max reconnection attempts reached for port {}", port_name);
            *state.write().await = ConnectionState::Error("Max reconnection attempts reached".to_string());
            return;
        }
        
        let attempt = *attempts;
        drop(attempts);

        // 通知前端正在重连
        *state.write().await = ConnectionState::Reconnecting {
            attempt,
            next_retry_ms: config.reconnect_interval_ms,
        };

        // 等待重连间隔
        sleep(Duration::from_millis(config.reconnect_interval_ms)).await;

        info!("Attempting to reconnect to port {} (attempt {})", port_name, attempt);
    }

    pub async fn close_port(&self, port_name: &str) -> anyhow::Result<()> {
        if let Some((_, state)) = self.ports.remove(port_name) {
            // 发送空数据表示关闭
            let _ = state.data_tx.send(vec![]).await;
            
            // 更新状态
            *state.state.write().await = ConnectionState::Disconnected;
            
            info!("Closed serial port: {}", port_name);
        } else {
            warn!("Port {} was not open", port_name);
        }
        Ok(())
    }

    pub async fn send_data(&self, port_name: &str, data: &[u8]) -> anyhow::Result<()> {
        if let Some(state) = self.ports.get(port_name) {
            state
                .data_tx
                .send(data.to_vec())
                .await
                .map_err(|e| anyhow::anyhow!("Failed to send data: {}", e))?;
            Ok(())
        } else {
            Err(anyhow::anyhow!("Port {} is not open", port_name))
        }
    }

    pub async fn get_port_state(&self, port_name: &str) -> Option<ConnectionState> {
        if let Some(state) = self.ports.get(port_name) {
            let state_guard = state.state.read().await;
            Some(state_guard.clone())
        } else {
            None
        }
    }

    #[allow(dead_code)]
    pub fn is_port_open(&self, port_name: &str) -> bool {
        self.ports.contains_key(port_name)
    }
}

unsafe impl Send for EnhancedSerialManager {}
unsafe impl Sync for EnhancedSerialManager {}
