'use client';

import { useEffect, useMemo, useRef, useState } from "react";

type GalleryItem = {
  id: string;
  url: string;
  createdAt: number;
};

const VIDEO_DURATION_MS = 10_000;

export default function AsmrGenerator() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const generateId = useMemo(
    () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID.bind(crypto) : () => Math.random().toString(36).slice(2)),
    []
  );

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (audioSourceRef.current) {
        try {
          audioSourceRef.current.stop();
        } catch {
          // ignored: node already stopped
        } finally {
          audioSourceRef.current = null;
        }
      }
      audioContextRef.current?.close();
    };
  }, []);

  const startAmbientAnimation = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas unavailable");
    }

    const particles = Array.from({ length: 24 }, (_, index) => ({
      seed: index + 1,
      radius: 60 + index * 22,
    }));

    const render = (timestamp: number) => {
      const time = timestamp / 1000;
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, `rgba(35, 17, 64, 0.9)`);
      gradient.addColorStop(0.5, `rgba(76, 29, 149, 0.85)`);
      gradient.addColorStop(1, `rgba(168, 85, 247, 0.82)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      particles.forEach((particle) => {
        const float = Math.sin(time * 0.5 + particle.seed) * 0.5 + 0.5;
        const pulse = Math.sin(time * 1.4 + particle.seed * 0.3) * 0.5 + 0.5;

        const centerX = width / 2 + Math.cos(time * 0.2 + particle.seed) * 40;
        const centerY = height / 2 + Math.sin(time * 0.18 + particle.seed * 0.5) * 60;
        const radius = particle.radius * (0.7 + pulse * 0.3);

        const radial = ctx.createRadialGradient(centerX, centerY, radius * 0.2, centerX, centerY, radius);
        radial.addColorStop(0, `rgba(244, 114, 182, ${0.35 + float * 0.25})`);
        radial.addColorStop(0.5, `rgba(129, 140, 248, ${0.2 + float * 0.35})`);
        radial.addColorStop(1, `rgba(59, 130, 246, 0)`);

        ctx.fillStyle = radial;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.fillStyle = `rgba(255, 255, 255, 0.07)`;
      ctx.fillRect(0, height * 0.65, width, height);

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);
  };

  const stopAmbientAnimation = () => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };

  const buildAsmrAudio = async () => {
    const context = new AudioContext();
    const buffer = context.createBuffer(2, context.sampleRate * (VIDEO_DURATION_MS / 1000), context.sampleRate);

    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const data = buffer.getChannelData(channel);
      let previousValue = 0;
      for (let i = 0; i < data.length; i += 1) {
        const random = Math.random() * 2 - 1;
        previousValue = previousValue * 0.98 + random * 0.02;
        const envelope = Math.sin((Math.PI * i) / data.length);
        data[i] = previousValue * 0.35 * envelope;
      }
    }

    const bufferSource = context.createBufferSource();
    bufferSource.buffer = buffer;

    const lowPass = context.createBiquadFilter();
    lowPass.type = "lowpass";
    lowPass.frequency.value = 850;

    const highPass = context.createBiquadFilter();
    highPass.type = "highpass";
    highPass.frequency.value = 120;

    const gain = context.createGain();
    gain.gain.value = 0.45;

    const speakerPan = context.createStereoPanner();
    const capturePan = context.createStereoPanner();
    let panDirection = -0.6;
    const panInterval = setInterval(() => {
      speakerPan.pan.setValueAtTime(panDirection, context.currentTime);
      capturePan.pan.setValueAtTime(panDirection, context.currentTime);
      panDirection = -panDirection;
    }, 2400);

    bufferSource.connect(lowPass).connect(highPass).connect(gain);
    gain.connect(speakerPan).connect(context.destination);

    const destination = context.createMediaStreamDestination();
    gain.connect(capturePan).connect(destination);

    bufferSource.start();

    audioContextRef.current = context;
    audioSourceRef.current = bufferSource;

    const cleanup = () => {
      clearInterval(panInterval);
      bufferSource.onended = null;
      if (context.state !== "closed") {
        context.close();
      }
      if (audioContextRef.current === context) {
        audioContextRef.current = null;
      }
      if (audioSourceRef.current === bufferSource) {
        audioSourceRef.current = null;
      }
    };

    bufferSource.onended = cleanup;

    return destination.stream;
  };

  const handleGenerate = async () => {
    if (isGenerating) {
      return;
    }
    setError(null);

    const canvas = canvasRef.current;
    if (!canvas) {
      setError("Canvas element not ready. Reload and try again.");
      return;
    }

    try {
      setIsGenerating(true);
      if (canvasRef.current) {
        canvasRef.current.width = 1280;
        canvasRef.current.height = 720;
      }
      startAmbientAnimation(canvas);
      const visualStream = canvas.captureStream(60);
      streamRef.current = visualStream;

      const audioStream = await buildAsmrAudio();

      audioStream.getAudioTracks().forEach((track) => {
        visualStream.addTrack(track);
      });

      const recorder = new MediaRecorder(visualStream, {
        mimeType: "video/webm;codecs=vp9,opus",
        videoBitsPerSecond: 3_000_000,
      });

      mediaRecorderRef.current = recorder;
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onerror = () => {
        setError("Media recorder error. Try again in a desktop browser.");
        setIsGenerating(false);
      };

      recorder.onstop = () => {
        stopAmbientAnimation();
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        if (audioSourceRef.current) {
          try {
            audioSourceRef.current.stop();
          } catch {
            // already stopped
          } finally {
            audioSourceRef.current = null;
          }
        }
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }

        const blob = new Blob(chunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        setGallery((previous) => [
          {
            id: generateId(),
            url,
            createdAt: Date.now(),
          },
          ...previous,
        ]);
        setIsGenerating(false);
      };

      recorder.start();

      setTimeout(() => {
        if (recorder.state !== "inactive") {
          recorder.stop();
        }
        if (audioSourceRef.current) {
          try {
            audioSourceRef.current.stop();
          } catch {
            // ignored
          } finally {
            audioSourceRef.current = null;
          }
        }
      }, VIDEO_DURATION_MS);
    } catch (err) {
      console.error(err);
      setError("Unable to generate ASMR video. Confirm MediaRecorder support.");
      setIsGenerating(false);
      stopAmbientAnimation();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      audioSourceRef.current?.stop();
    }
  };

  return (
    <section className="relative rounded-3xl border border-white/10 bg-white/5 px-6 py-8 shadow-2xl shadow-black/40 backdrop-blur-xl sm:px-10 sm:py-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-rose-50 sm:text-3xl">
              One-tap serenity
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-rose-100/80 sm:text-base">
              Generate a 10 second ASMR loop with warm gradients and whisper-soft soundscapes.
              Each render is captured locally and lands in your gallery once complete.
            </p>
          </div>
          <button
            className="inline-flex items-center justify-center rounded-full border border-white/20 bg-rose-500/80 px-6 py-3 text-sm font-semibold uppercase tracking-wider text-white shadow-lg shadow-rose-900/40 transition hover:bg-rose-400/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-rose-200"
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? "Rendering…" : "Generate 10s ASMR"}
          </button>
        </div>

        <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-inner shadow-black/40">
          <canvas
            ref={canvasRef}
            className="h-full w-full"
            aria-hidden="true"
          />
          {isGenerating && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm uppercase tracking-[0.3em] text-white">
              Capturing Tranquility
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium uppercase tracking-[0.2em] text-rose-100/70">
            Gallery
          </h3>
          {gallery.length === 0 ? (
            <p className="text-sm text-rose-100/70">
              No videos yet. Create one to begin your gallery.
            </p>
          ) : (
            <ul className="grid gap-6 md:grid-cols-2">
              {gallery.map((item) => (
                <li
                  key={item.id}
                  className="group rounded-2xl border border-white/10 bg-black/30 p-4 shadow-md shadow-black/40 transition hover:border-white/20"
                >
                  <video
                    className="aspect-video w-full rounded-xl bg-black/40"
                    src={item.url}
                    controls
                    preload="metadata"
                  />
                  <div className="mt-3 flex items-center justify-between text-xs text-rose-100/80">
                    <span>{new Date(item.createdAt).toLocaleTimeString()}</span>
                    <a
                      href={item.url}
                      download={`asmr-${item.createdAt}.webm`}
                      className="rounded-full border border-white/20 px-3 py-1 font-semibold uppercase tracking-widest text-white/90 transition hover:bg-white/10"
                    >
                      Save
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && (
          <p className="rounded-2xl border border-rose-500/40 bg-rose-500/20 px-4 py-3 text-sm text-rose-50">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
