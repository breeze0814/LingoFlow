#[tauri::command]
pub fn debug_print(message: String) {
    println!("{message}");
}
