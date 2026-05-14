"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Eye, Trash, X } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { ModeToggle } from "@/components/ModeToggle";

type AudioEntry = {
  filepath: string;
  label: string;
  blobUrl: string | null;
};

export default function SupertonicPage() {
  const [text, setText] = useState("");
  const [voiceStyle, setVoiceStyle] = useState("M1");
  const [lang, setLang] = useState("en");
  const [totalStep, setTotalStep] = useState(8);
  const [speed, setSpeed] = useState(1.05);
  const [output, setOutput] = useState("output");
  const [loading, setLoading] = useState(false);
  const [audioEntries, setAudioEntries] = useState<AudioEntry[]>([]);
  const [loadingAudios, setLoadingAudios] = useState<Set<string>>(new Set());
  const [showFilenameModal, setShowFilenameModal] = useState(false);
  const [tempFilename, setTempFilename] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedAudio, setSelectedAudio] = useState<AudioEntry | null>(null);
  const [filesDrawerOpen, setFilesDrawerOpen] = useState(false);
  const blobUrlsRef = useRef<string[]>([]);
  const [progress, setProgress] = useState(0);

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
      // console.log("Audio files:", files);
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

  function openFilenameModal() {
    setTempFilename(output || "output");
    setShowFilenameModal(true);
  }

  async function generateSpeech() {
    try {
      setLoading(true);
      setProgress(0);

      // Fake progress animation
      const interval = setInterval(() => {
        setProgress((prev) => {
          // Stop at 95% until complete
          if (prev >= 95) return prev;

          return prev + 5;
        });
      }, 500);

      // const result =
      await invoke<string>("generate_tts", {
        output: "",
        filename: output,
        text,
        lang,
        voiceStyle: `assets/voice_styles/${voiceStyle}.json`,
        totalStep,
        speed,
      });
      // console.log("Generated:", result);
      await loadAudios();
      clearInterval(interval);

      setProgress(100);

      setTimeout(() => {
        // setText("");
        setLoading(false);
      }, 500);
    } catch (err) {
      console.error("generate_tts error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmFilename() {
    setOutput(tempFilename);
    setShowFilenameModal(false);
    await generateSpeech();
  }

  async function deleteFile(path: string) {
    try {
      const confirmDelete = window.confirm(
        "Are you sure you want to delete this audio file?",
      );

      if (!confirmDelete) return;
      const res = await invoke("delete_audio_file", {
        filepath: path,
      });

      console.log(res);
      setAudioEntries((prev) => prev.filter((e) => e.filepath !== path));
    } catch (err) {
      console.error("Delete failed:", err);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="flex-1 flex flex-col">
        {/* Header */}
        {/* <div className="mb-6 flex items-center justify-between bg-card p-6 rounded-3xl border border-border">
          <h1 className="text-3xl font-bold">Text To Speech</h1>
          <ModeToggle />
        </div> */}

        {/* Main Grid */}
        <div className="flex-1 flex">
          {/* Left Panel - Input Controls */}
          <div className="flex-1 bg-card p-8 flex flex-col">
            <div className="mb-6 flex items-center justify-between">
              <h1 className="text-3xl font-bold">Text To Speech</h1>
              <ModeToggle />
            </div>
            {/* Voice style and Language - Same Row */}
            <div className="mb-4 grid grid-cols-2 gap-3">
              <div>
                <div className="flex gap-2 mb-4">
                  <Label htmlFor="voice" className="text-xs font-medium">
                    Voice
                  </Label>
                  <select
                    id="voice"
                    value={voiceStyle}
                    onChange={(e) => setVoiceStyle(e.target.value)}
                    className="w-full rounded-lg border border-border bg-input dark:bg-background px-3 py-2 text-xs text-foreground outline-none hover:border-border focus:border-primary focus:ring-1 focus:ring-primary"
                  >
                    {[
                      { value: "M1", label: "Ethan" },
                      { value: "M2", label: "Noah" },
                      { value: "M3", label: "Liam" },
                      { value: "M4", label: "Oliver" },
                      { value: "M5", label: "Leo" },
                      { value: "F1", label: "Ava" },
                      { value: "F2", label: "Sophia" },
                      { value: "F3", label: "Isabella" },
                      { value: "F4", label: "Mia" },
                      { value: "F5", label: "Aria" },
                    ].map((voice) => (
                      <option key={voice.value} value={voice.value}>
                        {voice.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2 mb-4">
                  <Label htmlFor="language" className="text-xs font-medium">
                    Language
                  </Label>
                  <select
                    id="language"
                    value={lang}
                    onChange={(e) => setLang(e.target.value)}
                    className="w-full rounded-lg border border-border bg-input dark:bg-background px-3 py-2 text-xs text-foreground outline-none hover:border-border focus:border-primary focus:ring-1 focus:ring-primary"
                  >
                    {[
                      { code: "en", label: "English" },
                      { code: "ko", label: "Korean" },
                      { code: "ja", label: "Japanese" },
                      { code: "ar", label: "Arabic" },
                      { code: "bg", label: "Bulgarian" },
                      { code: "cs", label: "Czech" },
                      { code: "da", label: "Danish" },
                      { code: "de", label: "German" },
                      { code: "el", label: "Greek" },
                      { code: "es", label: "Spanish" },
                      { code: "et", label: "Estonian" },
                      { code: "fi", label: "Finnish" },
                      { code: "fr", label: "French" },
                      { code: "hi", label: "Hindi" },
                      { code: "hr", label: "Croatian" },
                      { code: "hu", label: "Hungarian" },
                      { code: "id", label: "Indonesian" },
                      { code: "it", label: "Italian" },
                      { code: "lt", label: "Lithuanian" },
                      { code: "lv", label: "Latvian" },
                      { code: "nl", label: "Dutch" },
                      { code: "pl", label: "Polish" },
                      { code: "pt", label: "Portuguese" },
                      { code: "ro", label: "Romanian" },
                      { code: "ru", label: "Russian" },
                      { code: "sk", label: "Slovak" },
                      { code: "sl", label: "Slovenian" },
                      { code: "sv", label: "Swedish" },
                      { code: "tr", label: "Turkish" },
                      { code: "uk", label: "Ukrainian" },
                      { code: "vi", label: "Vietnamese" },
                    ].map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-4">
                <div className="flex gap-2 mb-4">
                  <Label htmlFor="steps" className="text-xs font-medium">
                    Steps ({totalStep})
                  </Label>
                  <Input
                    id="steps"
                    type="range"
                    value={totalStep}
                    min={1}
                    max={50}
                    onChange={(e) => setTotalStep(Number(e.target.value))}
                    className="rounded-lg border-slate-700 px-3 py-2 text-xs text-foreground bg-input dark:bg-background"
                  />
                </div>
                <div className="flex gap-2 mb-4">
                  <Label htmlFor="speed" className="text-xs font-medium">
                    Speed ({speed.toFixed(2)}x)
                  </Label>
                  <Input
                    id="speed"
                    type="range"
                    value={speed}
                    min={0.5}
                    max={2}
                    step={0.05}
                    onChange={(e) => setSpeed(Number(e.target.value))}
                    className="rounded-lg border-slate-700px-3 py-2 text-xs text-foreground bg-input dark:bg-background"
                  />
                </div>
              </div>
            </div>

            {/* Text */}
            <div className="mb-4 flex-1 flex flex-col">
              {/* <Label htmlFor="text" className="mb-2 block text-sm font-medium">
                Text to Synthesize
              </Label> */}
              <Textarea
                id="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter text..."
                className="flex-1 rounded-2xl border-border bg-input text-foreground placeholder:text-muted-foreground resize-none"
              />
            </div>
            {loading && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 cursor-wait">
                <div className="w-[50%] rounded-3xl border border-border bg-card p-6 shadow-xl">
                  <div className="mb-3 text-sm font-medium">
                    Generating audio... {progress}%
                  </div>

                  <div className="h-4 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all duration-300"
                      style={{
                        width: `${progress}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Generate and View Files buttons */}
            <div className="grid grid-cols-2 gap-3 mt-auto">
              <Button
                onClick={openFilenameModal}
                disabled={loading || text.trim() === ""}
                className="rounded-2xl bg-primary px-6 py-4 h-auto font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Generating..." : "Generate"}
              </Button>
              <Button
                onClick={() => setFilesDrawerOpen(true)}
                className="rounded-2xl bg-secondary px-6 py-4 h-auto font-medium text-secondary-foreground hover:bg-secondary/90 transition-colors"
              >
                Files ({audioEntries.length})
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Filename Modal */}
      {showFilenameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-2xl border border-border bg-card p-6 w-96 shadow-lg">
            <h2 className="text-lg font-semibold mb-4">Enter Filename</h2>
            <Input
              type="text"
              value={tempFilename}
              onChange={(e) => setTempFilename(e.target.value)}
              placeholder="Enter filename..."
              className="rounded-lg border-border bg-input text-foreground placeholder:text-muted-foreground mb-6"
              autoFocus
            />
            <div className="flex gap-3">
              <Button
                onClick={() => setShowFilenameModal(false)}
                variant="outline"
                className="flex-1 rounded-lg border-border text-foreground hover:bg-secondary/10"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmFilename}
                disabled={loading || !tempFilename.trim()}
                className="flex-1 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {loading ? "Generating..." : "Generate"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Audio Files Drawer */}
      {filesDrawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-black/50"
            onClick={() => setFilesDrawerOpen(false)}
          />
          <div className="w-96 bg-card border-l border-border p-6 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Generated Audio Files</h2>
              <button
                onClick={() => setFilesDrawerOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {audioEntries.length === 0 ? (
              <div className="flex items-center justify-center rounded-2xl border border-dashed border-border py-12 flex-1">
                <p className="text-muted-foreground text-center">
                  No audio files yet
                </p>
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto flex-1">
                {audioEntries.map((entry) => (
                  <div
                    key={entry.filepath}
                    className="flex justify-between items-center cursor-pointer rounded-xl border border-border bg-input p-4 hover:border-border hover:bg-secondary/20 transition-colors"
                  >
                    <div>
                      <p className="text-xs text-muted-foreground truncate">
                        {entry.label}
                      </p>
                      {/* <p className="text-xs text-muted-foreground/70 mt-1">
                        Click to play
                      </p> */}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedAudio(entry);
                          setDrawerOpen(true);
                        }}
                        className="text-muted-foreground hover:text-red-500 transition-colors"
                      >
                        <Eye color="blue" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteFile(entry.filepath)}
                        className="text-muted-foreground hover:text-red-500 transition-colors"
                      >
                        <Trash color="red" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Audio Player Drawer */}
      {drawerOpen && selectedAudio && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-black/50"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="w-96 bg-card border-l border-border p-6 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Audio Player</h2>
              <button
                onClick={() => setDrawerOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <p className="text-xs text-muted-foreground mb-4 truncate">
              {selectedAudio.label}
            </p>

            {selectedAudio.blobUrl ? (
              <audio controls className="w-full mb-4">
                <source src={selectedAudio.blobUrl} type="audio/wav" />
                Your browser does not support the audio element.
              </audio>
            ) : loadingAudios.has(selectedAudio.filepath) ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-4 justify-center">
                <span className="animate-spin">⏳</span> Loading…
              </div>
            ) : (
              <Button
                onClick={() => loadAudioFile(selectedAudio.filepath)}
                className="w-full rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Load &amp; Play
              </Button>
            )}

            <div className="mt-auto pt-6 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">Filename</p>
              <p className="text-sm font-medium break-all">
                {selectedAudio.label}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
