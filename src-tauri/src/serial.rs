use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Runtime};
use tokio::sync::mpsc;
use tokio::time::sleep;
use tracing::{debug, error, info, warn};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SerialPortInfo {
    pub name: String,
    pub vid: Option<u16>,
    pub pid: Option<u16>,
    pub manufacturer: Option<String>,
    pub serial_number: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortConfig {
    pub port_name: String,
    pub baud_rate: u32,
    pub data_bits: u8,
    pub parity: String,
    pub stop_bits: f64,
    pub flow_control: String,
}

pub struct PortHandle {
    #[allow(dead_code)]
    config: PortConfig,
    data_tx: mpsc::Sender<Vec<u8>>,
    _worker_handle: tokio::task::JoinHandle<()>,
}

pub struct SerialManager {
    ports: DashMap<String, PortHandle>,
}

impl SerialManager {
    pub fn new() -> Self {
        Self {
            ports: DashMap::new(),
        }
    }

    pub async fn list_ports(&self) -> anyhow::Result<Vec<SerialPortInfo>> {
        info!("开始扫描串口...");
        let ports = serialport::available_ports()?;
        info!("发现 {} 个串口", ports.len());
        
        let result: Vec<SerialPortInfo> = ports
            .into_iter()
            .map(|p| {
                let (vid, pid, manufacturer, serial_number) = match &p.port_type {
                    serialport::SerialPortType::UsbPort(info) => {
                        info!("USB 串口：{} (VID: {:04X}, PID: {:04X})", 
                            p.port_name, 
                            info.vid, 
                            info.pid);
                        (Some(info.vid), Some(info.pid), info.manufacturer.clone(), info.serial_number.clone())
                    }
                    serialport::SerialPortType::PciPort => {
                        info!("PCI 串口：{}", p.port_name);
                        (None, None, None, None)
                    }
                    _ => {
                        info!("其他串口：{}", p.port_name);
                        (None, None, None, None)
                    }
                };
                let info = SerialPortInfo {
                    name: p.port_name,
                    vid,
                    pid,
                    manufacturer,
                    serial_number,
                };
                debug!("串口信息：{:?}", info);
                info
            })
            .collect();
        Ok(result)
    }

    pub async fn open_port<R: Runtime>(
        &self,
        config: PortConfig,
        app_handle: AppHandle<R>,
    ) -> anyhow::Result<String> {
        let port_name = config.port_name.clone();

        if self.ports.contains_key(&port_name) {
            return Err(anyhow::anyhow!("Port {} is already open", port_name));
        }

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

        let stop_bits = match config.stop_bits {
            2.0 => serialport::StopBits::Two,
            _ => serialport::StopBits::One,
        };

        let flow_control = match config.flow_control.as_str() {
            "software" => serialport::FlowControl::Software,
            "hardware" => serialport::FlowControl::Hardware,
            _ => serialport::FlowControl::None,
        };

        let port = serialport::new(&port_name, config.baud_rate)
            .data_bits(data_bits)
            .parity(parity)
            .stop_bits(stop_bits)
            .flow_control(flow_control)
            .timeout(Duration::from_millis(100))
            .open()?;

        info!("Opened serial port: {}", port_name);

        let (data_tx, mut data_rx) = mpsc::channel::<Vec<u8>>(1024);
        let _port_name_clone = port_name.clone();
        let port_name_for_read = port_name.clone();
        let port_name_for_write = port_name.clone();
        let port_name_for_worker = port_name.clone();

        // 使用 Arc<Mutex> 来共享串口，分离读写
        let port = Arc::new(tokio::sync::Mutex::new(port));
        let port_for_read = port.clone();
        let app_handle_for_read = app_handle.clone();

        // 创建一个关闭信号通道
        let (shutdown_tx, mut shutdown_rx) = mpsc::channel::<()>(1);
        let shutdown_tx_for_write = shutdown_tx.clone();

        // 读取任务
        let read_handle = tokio::spawn(async move {
            let mut buf = vec![0u8; 1024];
            let mut consecutive_ok = 0u32;
            let mut consecutive_errors = 0u32;
            let max_consecutive_errors = 100u32; // 最多允许连续100次错误
            let mut init_count = 0u32; // 初始化计数器
            const INIT_DELAY_MS: u64 = 500; // 初始化期间每次尝试的延迟

            info!("读取任务启动: {}", port_name_for_read);

            // 初始化阶段：前100次读取给予更长延迟，帮助设备准备
            loop {
                // 检查是否收到关闭信号
                if let Ok(_) = shutdown_rx.try_recv() {
                    info!("读取任务收到关闭信号，停止: {}", port_name_for_read);
                    break;
                }

                // 初始化阶段结束后切换到正常模式
                if init_count >= 100 {
                    break;
                }

                let mut port = port_for_read.lock().await;
                match port.read(buf.as_mut_slice()) {
                    Ok(n) if n > 0 => {
                        consecutive_errors = 0;
                        consecutive_ok += 1;
                        init_count += 1;
                        let data = buf[..n].to_vec();
                        info!("从 {} 读取 {} 字节 (初始化阶段第{}次)", port_name_for_read, n, init_count);

                        let _ = app_handle_for_read.emit(
                            "serial-data",
                            serde_json::json!({
                                "portName": port_name_for_read,
                                "data": data,
                                "timestamp": chrono::Utc::now().timestamp_millis(),
                            }),
                        );
                    }
                    Ok(_) => {
                        // 没有数据，这是正常的
                        consecutive_errors = 0;
                        init_count += 1;
                    }
                    Err(e) => {
                        init_count += 1;
                        consecutive_ok = 0;
                        consecutive_errors += 1;
                        
                        match e.kind() {
                            std::io::ErrorKind::TimedOut => {
                                // 超时是正常的
                            }
                            _ => {
                                warn!("串口 {} 初始化阶段读取错误: {:?} - {}",
                                    port_name_for_read, e.kind(), e);
                            }
                        }
                        // 初始化阶段使用更长延迟
                        drop(port);
                        sleep(Duration::from_millis(INIT_DELAY_MS)).await;
                        continue;
                    }
                }
                // 释放锁，让其他任务有机会获取
                drop(port);
                sleep(Duration::from_millis(10)).await;
            }

            info!("读取任务初始化阶段完成，开始正常读取: {}", port_name_for_read);

            // 正常读取阶段
            loop {
                // 检查是否收到关闭信号
                if let Ok(_) = shutdown_rx.try_recv() {
                    info!("读取任务收到关闭信号，停止: {}", port_name_for_read);
                    break;
                }

                let mut port = port_for_read.lock().await;
                match port.read(buf.as_mut_slice()) {
                    Ok(n) if n > 0 => {
                        consecutive_errors = 0;
                        consecutive_ok += 1;
                        let data = buf[..n].to_vec();
                        
                        if consecutive_ok <= 3 || consecutive_ok % 100 == 0 {
                            info!("从 {} 读取 {} 字节 (第{}次成功)", port_name_for_read, n, consecutive_ok);
                        }

                        let _ = app_handle_for_read.emit(
                            "serial-data",
                            serde_json::json!({
                                "portName": port_name_for_read,
                                "data": data,
                                "timestamp": chrono::Utc::now().timestamp_millis(),
                            }),
                        );
                    }
                    Ok(_) => {
                        // 没有数据，重置错误计数
                        consecutive_errors = 0;
                    }
                    Err(e) => {
                        consecutive_errors += 1;
                        match e.kind() {
                            std::io::ErrorKind::TimedOut => {
                                // 超时是正常的，继续读取
                                consecutive_errors = 0;
                            }
                            _ => {
                                if consecutive_errors <= 5 || consecutive_errors % 20 == 0 {
                                    warn!("串口 {} 读取错误 (连续{}次): {:?} - {}",
                                        port_name_for_read, consecutive_errors, e.kind(), e);
                                }
                                sleep(Duration::from_millis(10)).await;
                            }
                        }

                        // 如果连续错误太多，停止读取
                        if consecutive_errors > max_consecutive_errors {
                            error!("串口 {} 连续错误次数过多({})，停止读取任务",
                                port_name_for_read, consecutive_errors);
                            break;
                        }
                    }
                }
                // 释放锁
                drop(port);
                sleep(Duration::from_millis(1)).await;
            }
            info!("读取任务停止: {} (成功{}次)", port_name_for_read, consecutive_ok);
        });

        // 写入任务
        let write_handle = tokio::spawn(async move {
            loop {
                match data_rx.recv().await {
                    Some(data) if data.is_empty() => {
                        info!("收到关闭信号，停止写入任务: {}", port_name_for_write);
                        // 通知读取任务也停止
                        let _ = shutdown_tx_for_write.send(()).await;
                        break;
                    }
                    Some(data) => {
                        let mut port = port.lock().await;
                        if let Err(e) = port.write_all(&data) {
                            error!("写入串口 {} 错误: {}", port_name_for_write, e);
                        } else {
                            info!("向 {} 写入 {} 字节", port_name_for_write, data.len());
                        }
                        drop(port);
                    }
                    None => {
                        info!("通道关闭，停止写入任务: {}", port_name_for_write);
                        // 通知读取任务也停止
                        let _ = shutdown_tx_for_write.send(()).await;
                        break;
                    }
                }
            }
            info!("写入任务停止: {}", port_name_for_write);
        });

        // 合并两个任务
        let worker_handle = tokio::spawn(async move {
            tokio::select! {
                _ = read_handle => {},
                _ = write_handle => {},
            }
            info!("串口 worker 完全停止: {}", port_name_for_worker);
        });

        let handle = PortHandle {
            config: config.clone(),
            data_tx,
            _worker_handle: worker_handle,
        };

        self.ports.insert(port_name.clone(), handle);

        Ok(port_name)
    }

    pub async fn close_port(&self, port_name: &str) -> anyhow::Result<()> {
        if let Some((_, handle)) = self.ports.remove(port_name) {
            // 发送空数据作为关闭信号
            match handle.data_tx.send(vec![]).await {
                Ok(_) => info!("发送关闭信号到端口: {}", port_name),
                Err(e) => warn!("发送关闭信号失败: {}", e),
            }
            // 等待 worker 结束
            // 注意：这里我们不等待 JoinHandle，让它在后台完成
            info!("Closed serial port: {}", port_name);
        } else {
            warn!("Port {} was not open", port_name);
        }
        Ok(())
    }

    pub async fn send_data(&self, port_name: &str, data: &[u8]) -> anyhow::Result<()> {
        if let Some(handle) = self.ports.get(port_name) {
            handle
                .data_tx
                .send(data.to_vec())
                .await
                .map_err(|e| anyhow::anyhow!("Failed to send data: {}", e))?;
            Ok(())
        } else {
            Err(anyhow::anyhow!("Port {} is not open", port_name))
        }
    }

    #[allow(dead_code)]
    pub fn is_port_open(&self, port_name: &str) -> bool {
        self.ports.contains_key(port_name)
    }
}

unsafe impl Send for SerialManager {}
unsafe impl Sync for SerialManager {}
