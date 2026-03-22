use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use tokio::time::{interval, Duration};
use tracing::debug;

/// 波形数据点
#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct WaveformPoint {
    pub timestamp: i64,
    pub channel: u8,
    pub value: f32,
}

/// 波形数据批次 - 用于批量传输
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WaveformBatch {
    pub timestamp: i64,
    pub values: Vec<f32>,
}

/// 双缓冲数据结构
pub struct DoubleBuffer {
    buffer_a: VecDeque<WaveformBatch>,
    buffer_b: VecDeque<WaveformBatch>,
    active_buffer: Arc<RwLock<char>>,
    #[allow(dead_code)]
    max_size: usize,
}

impl DoubleBuffer {
    pub fn new(max_size: usize) -> Self {
        Self {
            buffer_a: VecDeque::with_capacity(max_size),
            buffer_b: VecDeque::with_capacity(max_size),
            active_buffer: Arc::new(RwLock::new('A')),
            max_size,
        }
    }

    /// 写入数据到活动缓冲区
    #[allow(dead_code)]
    pub async fn write(&mut self, data: WaveformBatch) {
        let active = *self.active_buffer.read().await;
        let buffer = if active == 'A' {
            &mut self.buffer_a
        } else {
            &mut self.buffer_b
        };

        if buffer.len() >= self.max_size {
            buffer.pop_front();
        }
        buffer.push_back(data);
    }

    /// 交换缓冲区并返回非活动缓冲区的数据
    pub async fn swap_and_read(&mut self) -> Vec<WaveformBatch> {
        let mut active = self.active_buffer.write().await;
        *active = if *active == 'A' { 'B' } else { 'A' };
        
        // 读取并清空非活动缓冲区
        let buffer = if *active == 'A' {
            &mut self.buffer_b
        } else {
            &mut self.buffer_a
        };
        
        let data: Vec<WaveformBatch> = buffer.iter().cloned().collect();
        buffer.clear();
        data
    }
}

/// 波形数据管理器
pub struct WaveformManager {
    #[allow(dead_code)]
    data_tx: mpsc::Sender<WaveformBatch>,
    #[allow(dead_code)]
    buffer: Arc<RwLock<DoubleBuffer>>,
    #[allow(dead_code)]
    sample_rate: u32,
    #[allow(dead_code)]
    channels: u8,
}

impl WaveformManager {
    pub fn new(sample_rate: u32, channels: u8) -> (Self, mpsc::Receiver<WaveformBatch>) {
        let (data_tx, data_rx) = mpsc::channel(1000);
        let buffer = Arc::new(RwLock::new(DoubleBuffer::new(10000)));
        
        let manager = Self {
            data_tx,
            buffer: buffer.clone(),
            sample_rate,
            channels,
        };
        
        // 启动批量推送任务
        tokio::spawn(Self::batch_push_task(buffer));
        
        (manager, data_rx)
    }

    /// 解析串口数据为波形数据
    /// 支持多种数据格式：
    /// 1. 原始 ADC 值 (2字节一个点)
    /// 2. 浮点数值 (4字节一个点)
    /// 3. 文本格式 CSV
    #[allow(dead_code)]
    pub fn parse_serial_data(&self, data: &[u8], format: DataFormat) -> Option<WaveformBatch> {
        let timestamp = chrono::Utc::now().timestamp_millis();
        
        let values = match format {
            DataFormat::RawU16 => {
                // 每2字节一个 uint16 值
                data.chunks_exact(2)
                    .map(|chunk| {
                        let value = u16::from_le_bytes([chunk[0], chunk[1]]) as f32;
                        // 归一化到 0-3.3V 范围 (假设 12位 ADC)
                        value / 4095.0 * 3.3
                    })
                    .collect()
            }
            DataFormat::RawF32 => {
                // 每4字节一个 float32 值
                data.chunks_exact(4)
                    .map(|chunk| {
                        f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]])
                    })
                    .collect()
            }
            DataFormat::CsvText => {
                // CSV 格式: "1.23,2.34,3.45"
                String::from_utf8_lossy(data)
                    .split(',')
                    .filter_map(|s| s.trim().parse::<f32>().ok())
                    .collect()
            }
            DataFormat::Custom(parser) => parser(data),
        };

        if values.is_empty() {
            None
        } else {
            Some(WaveformBatch { timestamp, values })
        }
    }

    /// 推送数据到缓冲区
    #[allow(dead_code)]
    pub async fn push_data(&self, data: WaveformBatch) -> anyhow::Result<()> {
        self.data_tx.send(data).await?;
        Ok(())
    }

    #[allow(dead_code)]
    async fn batch_push_task(buffer: Arc<RwLock<DoubleBuffer>>) {
        let mut ticker = interval(Duration::from_millis(33)); // ~30 FPS
        
        loop {
            ticker.tick().await;
            
            // 这里可以通过 Tauri 事件将数据推送到前端
            // 实际实现需要在 AppHandle 上下文中
            let data = buffer.write().await.swap_and_read().await;
            
            if !data.is_empty() {
                debug!("Pushing {} waveform batches to frontend", data.len());
                // app_handle.emit("waveform-data", data);
            }
        }
    }
}

/// 数据格式枚举
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub enum DataFormat {
    RawU16,
    RawF32,
    CsvText,
    Custom(fn(&[u8]) -> Vec<f32>),
}

/// 波形配置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct WaveformConfig {
    pub channels: u8,
    pub sample_rate: u32,
    pub time_window_ms: u32,
    pub data_format: String,
    pub y_min: f32,
    pub y_max: f32,
}

impl Default for WaveformConfig {
    fn default() -> Self {
        Self {
            channels: 4,
            sample_rate: 1000,
            time_window_ms: 1000,
            data_format: "raw_u16".to_string(),
            y_min: 0.0,
            y_max: 3.3,
        }
    }
}
