# Text-to-Speech AI

A modern AI-powered Text-to-Speech desktop application built with **Tauri**, **Next.js**, and **TypeScript**, powered by ONNX models for fast and high-quality local voice generation.

---

## Features

- 🎤 AI-powered Text-to-Speech
- ⚡ Fast local inference using ONNX Runtime
- 🖥️ Cross-platform desktop application
- 🎛️ Adjustable speed and voice settings
- 💾 Save generated audio locally
- 🌙 Modern UI built with Next.js
- 📦 Lightweight and efficient with Tauri

---

# Tech Stack

- Tauri
- Next.js
- TypeScript
- Rust
- ONNX Runtime

---

## Setup Guide

### Clone the Repository

```bash
git clone https://github.com/HassanZohaib121/text-to-speech-AI.git
cd text-to-speech-AI
```

---

## Install Dependencies

```bash
npm install
```

---

## Run the Development Server

```bash
npx tauri dev
```

---

## Prerequisites

Before running the application, download the ONNX models and preset voices and place them inside:

```bash
src-tauri/assets
```

### Install Git LFS

The Hugging Face repository uses Git LFS for large model files.

#### macOS

```bash
brew install git-lfs
git lfs install
```

#### Windows / Linux

Visit:

```txt
https://git-lfs.com
```

---

## Download Models

```bash
git lfs install
git clone https://huggingface.co/Supertone/supertonic-3 assets
```

After downloading, move the assets folder into:

```bash
src-tauri/assets
```

---

## Project Structure

```bash
text-to-speech-AI/
├── src/
├── public/
├── src-tauri/
│   ├── assets/
│   ├── src/
│   └── tauri.conf.json
├── package.json
├── tsconfig.json
├── next.config.ts
└── README.md
```

---

## Build

Run the following command to generate production installers:

```bash
npx tauri build
```

Generated installers will be available inside:

```bash
src-tauri/target/release/bundle/
```

---

## Installation

Pick **one** installation method below.

### ⏬ Windows Installers

| Platform | Installer | Note |
|----------|------------|------|
| Windows | [MSI Installer](https://github.com/HassanZohaib121/text-to-speech-AI/releases/download/v0.1.1/text-to-speech_0.1.1_x64_en-US.msi) | SmartScreen may warn about an unknown app |
| Windows | [EXE Installer](https://github.com/HassanZohaib121/text-to-speech-AI/releases/download/v0.1.1/text-to-speech_0.1.1_x64-setup.exe) | SmartScreen may warn about an unknown app |

All Releases are Here [V0.1.1](https://github.com/HassanZohaib121/text-to-speech-AI/releases/)

---

## Development

### Start Frontend Only

```bash
npm run dev
```

### Start Tauri Desktop App

```bash
npx tauri dev
```

---

## Contributing

Contributions, issues, and feature requests are welcome.

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to your branch
5. Open a Pull Request

---

## License

This project is licensed under the MIT License.

---

## Repository

https://github.com/HassanZohaib121/text-to-speech-AI