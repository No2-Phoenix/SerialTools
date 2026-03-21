// 防止在 Windows 上运行时弹出命令行窗口
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serialport;

// 定义一个 Tauri Command，供前端调用来获取串口列表
#[tauri::command]
fn get_available_ports() -> Vec<String> {
    match serialport::available_ports() {
        Ok(ports) => ports.iter().map(|p| p.port_name.clone()).collect(),
        Err(_) => vec![],
    }
}

fn main() {
    tauri::Builder::default()
        // 注册上面定义的 Command
        .invoke_handler(tauri::generate_handler![get_available_ports])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}