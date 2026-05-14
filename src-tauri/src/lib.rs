#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::command;

use std::fs;
use std::path::PathBuf;

mod helper;

use helper::{
    load_text_to_speech,
    load_voice_style,
    write_wav_file,
    sanitize_filename,
};

/// Returns the `music/` folder next to the .exe, creating it if needed.
/// This is consistent whether running in dev or as an installed build.
fn music_dir() -> Result<PathBuf, String> {
    let dir = std::env::current_exe()
        .map_err(|e| e.to_string())?
        .parent()
        .ok_or("exe has no parent directory")?
        .join("music");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// ----------------------------
/// Generate TTS → save to MUSIC folder
/// ----------------------------
#[command]
fn generate_tts(
    text: String,
    filename: String,
    lang: String,
    voice_style: String,
    total_step: usize,
    speed: f32,
) -> Result<String, String> {

    println!("Starting TTS generation...");

    let base = std::env::current_exe()
        .map_err(|e| e.to_string())?
        .parent()
        .ok_or("exe has no parent directory")?
        .to_path_buf();
    let model_path = base.join("assets/onnx");

    // 1. Load model
    let mut text_to_speech = load_text_to_speech(
        model_path.to_str().unwrap(),
        false
    ).map_err(|e| e.to_string())?;

    // 2. Load voice style
    let style = load_voice_style(
        &vec![voice_style.clone()],
        true
    ).map_err(|e| e.to_string())?;

    // 3. Generate speech
    let (wav, duration) = text_to_speech.call(
        &text,
        &lang,
        &style,
        total_step,
        speed,
        0.3
    ).map_err(|e| e.to_string())?;

    // 4. Get music dir (next to exe)
    let music_dir = music_dir()?;

    let safe_name = sanitize_filename(&filename, 40);
    let output_path = music_dir.join(format!("{}.wav", safe_name));

    // 5. Trim audio safely
    let actual_len = (text_to_speech.sample_rate as f32 * duration) as usize;
    let wav_slice = &wav[..actual_len.min(wav.len())];

    // 6. Save WAV
    write_wav_file(
        output_path.to_str().unwrap(),
        wav_slice,
        text_to_speech.sample_rate
    ).map_err(|e| e.to_string())?;

    println!("Saved: {}", output_path.display());

    // 7. Return absolute path
    Ok(output_path
        .canonicalize()
        .map_err(|e| e.to_string())?
        .to_string_lossy()
        .to_string()
    )
}

/// ----------------------------
/// SAVE AUDIO FILE (base64 → music/)
/// ----------------------------
#[command]
fn save_audio(filename: String, data: String) -> Result<String, String> {
    use base64::{engine::general_purpose, Engine as _};

    let bytes = general_purpose::STANDARD
        .decode(&data)
        .map_err(|e| format!("base64 decode error: {}", e))?;

    let music_dir = music_dir()?;

    let safe_name = sanitize_filename(&filename, 40);
    let ext = PathBuf::from(&filename)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("wav")
        .to_string();

    let file_path = music_dir.join(format!("{}.{}", safe_name, ext));
    fs::write(&file_path, bytes).map_err(|e| e.to_string())?;

    let abs = file_path
        .canonicalize()
        .unwrap_or(file_path)
        .to_string_lossy()
        .to_string();

    println!("Audio saved: {}", abs);
    Ok(abs)
}

/// ----------------------------
/// LOAD AUDIO FILE → base64
/// ----------------------------
#[command]
fn load_audio(filepath: String) -> Result<String, String> {
    use base64::{engine::general_purpose, Engine as _};

    let bytes = fs::read(&filepath)
        .map_err(|e| format!("Failed to read '{}': {}", filepath, e))?;

    Ok(general_purpose::STANDARD.encode(&bytes))
}

/// ----------------------------
/// LIST AUDIO FILES
/// ----------------------------
#[command]
fn list_audio_files() -> Result<Vec<String>, String> {

    let dir = music_dir()?;

    if !dir.exists() {
        return Ok(vec![]);
    }

    let mut files = vec![];

    let entries = fs::read_dir(&dir)
        .map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        if let Some(ext) = path.extension() {
            if ext == "wav" || ext == "mp3" {
                files.push(
                    path.canonicalize()
                        .unwrap_or(path)
                        .to_string_lossy()
                        .to_string()
                );
            }
        }
    }

    Ok(files)
}

/// ----------------------------
/// TAURI RUNNER
/// ----------------------------
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {

    tauri::Builder::default()
        .invoke_handler(
            tauri::generate_handler![
                generate_tts,
                save_audio,
                load_audio,
                list_audio_files
            ]
        )
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build()
        )
        .run(
            tauri::generate_context!()
        )
        .expect("error while running tauri application");
}