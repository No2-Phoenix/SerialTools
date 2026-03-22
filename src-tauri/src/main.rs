#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod serial;
mod serial_enhanced;
mod waveform;

use serial::{SerialManager, PortConfig};
use serial_enhanced::{EnhancedSerialManager, EnhancedPortConfig, ConnectionState};
use std::sync::Arc;
use tauri::{State, AppHandle, Emitter, Runtime};
use tracing::{info, error};

pub struct AppState {
    serial_manager: Arc<SerialManager>,
    enhanced_manager: Arc<EnhancedSerialManager>,
}

#[tauri::command]
async fn list_serial_ports(
    state: State<'_, AppState>,
) -> Result<Vec<serial::SerialPortInfo>, String> {
    state
        .serial_manager
        .list_ports()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn open_serial_port<R: Runtime>(
    state: State<'_, AppState>,
    config: PortConfig,
    app_handle: AppHandle<R>,
) -> Result<String, String> {
    info!("收到打开串口请求: {:?}", config);
    let result = state
        .serial_manager
        .open_port(config, app_handle)
        .await;
    match &result {
        Ok(_) => info!("串口打开成功"),
        Err(e) => error!("串口打开失败: {}", e),
    }
    result.map_err(|e| e.to_string())
}

#[tauri::command]
async fn close_serial_port(
    state: State<'_, AppState>,
    port_name: String,
) -> Result<(), String> {
    state
        .serial_manager
        .close_port(&port_name)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn send_serial_data(
    state: State<'_, AppState>,
    port_name: String,
    data: Vec<u8>,
) -> Result<(), String> {
    state
        .serial_manager
        .send_data(&port_name, &data)
        .await
        .map_err(|e| e.to_string())
}

// Enhanced serial commands
#[tauri::command]
async fn open_enhanced_port(
    state: State<'_, AppState>,
    config: EnhancedPortConfig,
) -> Result<String, String> {
    state
        .enhanced_manager
        .open_port(config)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn close_enhanced_port(
    state: State<'_, AppState>,
    port_name: String,
) -> Result<(), String> {
    state
        .enhanced_manager
        .close_port(&port_name)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn send_enhanced_data(
    state: State<'_, AppState>,
    port_name: String,
    data: Vec<u8>,
) -> Result<(), String> {
    state
        .enhanced_manager
        .send_data(&port_name, &data)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_port_state(
    state: State<'_, AppState>,
    port_name: String,
) -> Result<ConnectionState, String> {
    state
        .enhanced_manager
        .get_port_state(&port_name)
        .await
        .ok_or_else(|| "Port not found".to_string())
}

// Global shortcut commands
#[tauri::command]
fn trigger_send<R: Runtime>(app_handle: AppHandle<R>) {
    app_handle.emit("shortcut-send", ()).ok();
}

#[tauri::command]
fn trigger_clear<R: Runtime>(app_handle: AppHandle<R>) {
    app_handle.emit("shortcut-clear", ()).ok();
}

#[tauri::command]
fn trigger_newline<R: Runtime>(app_handle: AppHandle<R>) {
    app_handle.emit("shortcut-newline", ()).ok();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt::init();

    let serial_manager = Arc::new(SerialManager::new());
    let enhanced_manager = Arc::new(EnhancedSerialManager::new());

    tauri::Builder::<tauri::Wry>::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        // 全局快捷键暂时禁用，需要系统权限
        // .plugin(tauri_plugin_global_shortcut::Builder::new()...)
        .manage(AppState { 
            serial_manager,
            enhanced_manager,
        })
        .invoke_handler(tauri::generate_handler![
            list_serial_ports,
            open_serial_port,
            close_serial_port,
            send_serial_data,
            open_enhanced_port,
            close_enhanced_port,
            send_enhanced_data,
            get_port_state,
            trigger_send,
            trigger_clear,
            trigger_newline,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run();
}
