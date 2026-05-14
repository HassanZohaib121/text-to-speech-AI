"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";
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
      const result = await invoke<string>("generate_tts", {
        output: "",
        filename: output,
        text,
        lang,
        voiceStyle: `assets/voice_styles/${voiceStyle}.json`,
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

  async function handleConfirmFilename() {
    setOutput(tempFilename);
    setShowFilenameModal(false);
    await generateSpeech();
  }

  return (
    <div className="h-screen bg-background text-foreground flex flex-col">
      <div className="flex-1 flex flex-col p-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between bg-card p-6 rounded-3xl border border-border">
          <h1 className="text-3xl font-bold">Text To Speech</h1>
          <ModeToggle />
        </div>

        {/* Main Grid */}
        <div className="flex-1 flex">
          {/* Left Panel - Input Controls */}
          <div className="flex-1 rounded-3xl border border-border bg-card p-8 flex flex-col">
            {/* Voice style and Language - Same Row */}
            <div className="mb-4 grid grid-cols-4 gap-3">
              <div>
                <Label htmlFor="voice" className="text-xs font-medium">
                  Voice
                </Label>
                <select
                  id="voice"
                  value={voiceStyle}
                  onChange={(e) => setVoiceStyle(e.target.value)}
                  className="w-full rounded-lg border border-border bg-input px-3 py-2 text-xs text-foreground outline-none hover:border-border focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  <option value="M1">M1</option>
                  <option value="M2">M2</option>
                  <option value="M3">M3</option>
                  <option value="M4">M4</option>
                  <option value="M5">M5</option>
                  <option value="F1">F1</option>
                  <option value="F2">F2</option>
                  <option value="F3">F3</option>
                  <option value="F4">F4</option>
                  <option value="F5">F5</option>
                </select>
              </div>
              <div>
                <Label htmlFor="language" className="text-xs font-medium">
                  Language
                </Label>
                <select
                  id="language"
                  value={lang}
                  onChange={(e) => setLang(e.target.value)}
                  className="w-full rounded-lg border border-border bg-input px-3 py-2 text-xs text-foreground outline-none hover:border-border focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  <option value="en">EN</option>
                  <option value="ko">KO</option>
                  <option value="ja">JA</option>
                  <option value="ar">AR</option>
                  <option value="de">DE</option>
                  <option value="es">ES</option>
                  <option value="fr">FR</option>
                  <option value="hi">HI</option>
                  <option value="it">IT</option>
                  <option value="ru">RU</option>
                  <option value="tr">TR</option>
                  <option value="uk">UK</option>
                </select>
              </div>
              <div>
                <Label htmlFor="steps" className="text-xs font-medium">
                  Steps
                </Label>
                <Input
                  id="steps"
                  type="number"
                  value={totalStep}
                  min={1}
                  max={50}
                  onChange={(e) => setTotalStep(Number(e.target.value))}
                  className="rounded-lg border-slate-700 px-3 py-2 text-xs text-foreground"
                />
              </div>
              <div>
                <Label htmlFor="speed" className="text-xs font-medium">
                  Speed
                </Label>
                <Input
                  id="speed"
                  type="number"
                  value={speed}
                  min={0.5}
                  max={2}
                  step={0.05}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  className="rounded-lg border-slate-700px-3 py-2 text-xs text-foreground"
                />
              </div>
            </div>

            {/* Text */}
            <div className="mb-4 flex-1 flex flex-col">
              <Label htmlFor="text" className="mb-2 block text-sm font-medium">
                Text to Synthesize
              </Label>
              <Textarea
                id="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter text..."
                className="flex-1 rounded-2xl border-border bg-input text-foreground placeholder:text-muted-foreground resize-none"
              />
            </div>

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
                    className="cursor-pointer rounded-xl border border-border bg-input p-4 hover:border-border hover:bg-secondary/20 transition-colors"
                    onClick={() => {
                      setSelectedAudio(entry);
                      setDrawerOpen(true);
                    }}
                  >
                    <p className="text-xs text-muted-foreground truncate">
                      {entry.label}
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Click to play
                    </p>
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
