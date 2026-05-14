"use client";

import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";

type AudioEntry = {
  filepath: string;
  label: string;
  blobUrl: string | null;
};

export default function SupertonicPage() {
  const [text, setText] = useState("");
  const [voiceStyle, setVoiceStyle] = useState("assets/voice_styles/M1.json");
  const [lang, setLang] = useState("en");
  const [totalStep, setTotalStep] = useState(8);
  const [speed, setSpeed] = useState(1.05);
  const [output, setOutput] = useState("output");
  const [loading, setLoading] = useState(false);
  const [audioEntries, setAudioEntries] = useState<AudioEntry[]>([]);
  const [loadingAudios, setLoadingAudios] = useState<Set<string>>(new Set());
  const blobUrlsRef = useRef<string[]>([]);

  // Convert base64 WAV bytes → blob URL
  const base64ToBlobUrl = (base64: string): string => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);
    blobUrlsRef.current.push(url);
    return url;
  };

  // Load a single audio file lazily (on demand)
  const loadAudioFile = useCallback(async (filepath: string) => {
    setLoadingAudios((prev) => new Set(prev).add(filepath));
    try {
      const base64 = await invoke<string>("load_audio", { filepath });
      const blobUrl = base64ToBlobUrl(base64);
      setAudioEntries((prev) =>
        prev.map((e) => (e.filepath === filepath ? { ...e, blobUrl } : e)),
      );
    } catch (err) {
      console.error("Failed to load audio:", filepath, err);
    } finally {
      setLoadingAudios((prev) => {
        const next = new Set(prev);
        next.delete(filepath);
        return next;
      });
    }
  }, []);

  const loadAudios = useCallback(async () => {
    try {
      const files = await invoke<string[]>("list_audio_files");
      console.log("Audio files:", files);
      const reversed = [...files].reverse();

      // Build all entries without blob URLs first
      const entries: AudioEntry[] = reversed.map((fp) => ({
        filepath: fp,
        label: fp.split(/[\\/]/).pop() ?? fp,
        blobUrl: null,
      }));
      setAudioEntries(entries);

      // Load ALL files in parallel, then apply all blob URLs in one state update
      const results = await Promise.all(
        reversed.map(async (fp) => {
          try {
            const base64 = await invoke<string>("load_audio", { filepath: fp });
            return { fp, blobUrl: base64ToBlobUrl(base64) };
          } catch {
            return { fp, blobUrl: null };
          }
        }),
      );

      const blobMap = new Map(results.map(({ fp, blobUrl }) => [fp, blobUrl]));

      setAudioEntries((prev) =>
        prev.map((e) => ({ ...e, blobUrl: blobMap.get(e.filepath) ?? null })),
      );
    } catch (err) {
      console.error("loadAudios error:", err);
    }
  }, []);

  // Cleanup blob URLs on unmount
  // useEffect(() => {
  //   return () => {
  //     blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  //   };
  // }, []);

  useEffect(() => {
    const urls = blobUrlsRef.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    async function init() {
      await loadAudios();
    }
    init();
  }, [loadAudios]);

  async function generateSpeech() {
    try {
      setLoading(true);
      const result = await invoke<string>("generate_tts", {
        output: "",
        filename: output,
        text,
        lang,
        voiceStyle,
        totalStep,
        speed,
      });
      console.log("Generated:", result);
      await loadAudios();
    } catch (err) {
      console.error("generate_tts error:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold">🎤 Text To Speech</h1>
          <p className="text-slate-400 mt-2">
            31-language Text-to-Speech with ONNX Runtime Web
          </p>
        </div>

        {/* STATUS */}
        {/* <div className="mb-6 flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-5 py-4">
          <div>
            <p className="font-medium">ℹ️ Loading models...</p>
            <p className="text-sm text-slate-400">Please wait...</p>
          </div>
          <div className="rounded-full bg-blue-500/20 px-4 py-1 text-sm text-blue-400 border border-blue-500/30">
            WebAssembly
          </div>
        </div> */}

        {/* MAIN */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* LEFT PANEL */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            {/* Output filename */}
            <div className="mb-6">
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium">Output Filename</label>
                <span className="text-xs text-slate-400">Optional</span>
              </div>
              <input
                type="text"
                value={output}
                onChange={(e) => setOutput(e.target.value)}
                placeholder="Enter output filename (default: output)"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none"
              />
            </div>

            {/* Voice style */}
            <div className="mb-6">
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium">Voice Style</label>
                <span className="text-xs text-slate-400">Ready</span>
              </div>
              <select
                value={voiceStyle}
                onChange={(e) => setVoiceStyle(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none"
              >
                <option value="assets/voice_styles/M1.json">Male 1 (M1)</option>
                <option value="assets/voice_styles/M2.json">Male 2 (M2)</option>
                <option value="assets/voice_styles/M3.json">Male 3 (M3)</option>
                <option value="assets/voice_styles/M4.json">Male 4 (M4)</option>
                <option value="assets/voice_styles/M5.json">Male 5 (M5)</option>
                <option value="assets/voice_styles/F1.json">
                  Female 1 (F1)
                </option>
                <option value="assets/voice_styles/F2.json">
                  Female 2 (F2)
                </option>
                <option value="assets/voice_styles/F3.json">
                  Female 3 (F3)
                </option>
                <option value="assets/voice_styles/F4.json">
                  Female 4 (F4)
                </option>
                <option value="assets/voice_styles/F5.json">
                  Female 5 (F5)
                </option>
              </select>
            </div>

            {/* Language */}
            <div className="mb-6">
              <label className="mb-2 block text-sm font-medium">Language</label>
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none"
              >
                <option value="en">English (en)</option>
                <option value="ko">한국어 (ko)</option>
                <option value="ja">日本語 (ja)</option>
                <option value="ar">العربية (ar)</option>
                <option value="de">Deutsch (de)</option>
                <option value="es">Español (es)</option>
                <option value="fr">Français (fr)</option>
                <option value="hi">Hindi (hi)</option>
                <option value="it">Italian (it)</option>
                <option value="ru">Russian (ru)</option>
                <option value="tr">Turkish (tr)</option>
                <option value="uk">Ukrainian (uk)</option>
              </select>
            </div>

            {/* Text */}
            <div className="mb-6">
              <label className="mb-2 block text-sm font-medium">
                Text to Synthesize
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter text..."
                className="min-h-55 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 outline-none resize-none"
              />
            </div>

            {/* Params */}
            <div className="mb-6 grid grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Total Steps
                </label>
                <input
                  type="number"
                  value={totalStep}
                  min={1}
                  max={50}
                  onChange={(e) => setTotalStep(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Speed</label>
                <input
                  type="number"
                  value={speed}
                  min={0.5}
                  max={2}
                  step={0.05}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none"
                />
              </div>
            </div>

            {/* Generate button */}
            <button
              onClick={generateSpeech}
              disabled={loading}
              className="w-full rounded-2xl bg-blue-600 px-6 py-4 font-medium transition hover:bg-blue-500 disabled:opacity-50"
            >
              {loading ? "Generating..." : "Generate Speech"}
            </button>
          </div>

          {/* RIGHT PANEL */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <div className="mb-4 text-lg font-semibold">
              Generated Audio Files
            </div>

            {audioEntries.length === 0 ? (
              <div className="flex h-80 items-center justify-center rounded-2xl border border-dashed border-slate-700">
                <p className="text-slate-400">No audio files yet</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-150 overflow-y-auto">
                {audioEntries.map((entry) => (
                  <div
                    key={entry.filepath}
                    className="rounded-xl border border-slate-700 bg-slate-950 p-4"
                  >
                    <p className="mb-2 text-xs text-slate-400 truncate">
                      {entry.label}
                    </p>

                    {entry.blobUrl ? (
                      // Blob URL ready → native audio player works perfectly
                      <audio controls className="w-full">
                        <source src={entry.blobUrl} type="audio/wav" />
                      </audio>
                    ) : loadingAudios.has(entry.filepath) ? (
                      <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
                        <span className="animate-spin">⏳</span> Loading…
                      </div>
                    ) : (
                      // Not yet loaded → lazy load on demand
                      <button
                        onClick={() => loadAudioFile(entry.filepath)}
                        className="w-full rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-400 hover:bg-slate-800 transition"
                      >
                        ▶ Load &amp; Play
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
