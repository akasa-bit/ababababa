// Tauri の包装: desktop/game/ (組み立てた index.html と assets/) を 1 枚の窓で開くだけ。
// NLU_BENCH があれば desktop/bench/probe.js を差し込み、結果の 1 行を標準出力に書いて閉じる。
// NLU_FULLSCREEN があれば全画面で開く (Steam Deck の Game Mode を想定)。
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{WebviewUrl, WebviewWindowBuilder};

#[tauri::command]
fn bench_report(app: tauri::AppHandle, json: String) {
    println!("NLU_BENCH {json}");
    app.exit(0);
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![bench_report])
        .setup(|app| {
            let mut w = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("NoLongerUbiquitous")
                .inner_size(1280.0, 800.0) // Steam Deck の画面
                .fullscreen(std::env::var_os("NLU_FULLSCREEN").is_some());
            if std::env::var_os("NLU_BENCH").is_some() {
                w = w.initialization_script(include_str!("../../../bench/probe.js"));
            }
            w.build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Tauri の起動に失敗");
}
