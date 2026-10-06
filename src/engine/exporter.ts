import { ArrayBufferTarget, Muxer } from "mp4-muxer";
import { drawScene, preloadAssets, prescale, type RenderEnv } from "./renderer";
import type { Asset, Scene, Stage } from "./types";

// Video export. Frames are rendered one by one at exact timestamps and encoded
// with WebCodecs, so the result is frame-perfect and usually much faster than
// real time. Browsers without WebCodecs fall back to real-time capture.

export type Quality = "720" | "1080" | "1440" | "4k" | "native";
const SHORT_SIDE: Record<string, number> = { "720": 720, "1080": 1080, "1440": 1440, "4k": 2160 };
const MAX_SIDE = 4096;
const even = (v: number) => Math.max(2, Math.round(v / 2) * 2);

/** Output size for a quality preset; always keeps the stage aspect ratio. */
export function pickSize(quality: Quality, stage: Stage, image: HTMLImageElement | null): { width: number; height: number } {
  const aspect = stage.w / stage.h;
  let w: number, h: number;
  if (quality === "native" && image) {
    const long = Math.max(image.naturalWidth, image.naturalHeight);
    if (aspect >= 1) { w = long; h = long / aspect; } else { h = long; w = long * aspect; }
  } else {
    const short = SHORT_SIDE[quality] ?? 1080;
    if (aspect >= 1) { h = short; w = short * aspect; } else { w = short; h = short / aspect; }
  }
  const k = Math.min(1, MAX_SIDE / Math.max(w, h));
  return { width: even(w * k), height: even(h * k) };
}

export interface ExportOptions {
  scene: Scene;
  assets: Record<string, Asset>;
  image: HTMLImageElement | null;
  narration: AudioBuffer | null;
  width: number;
  height: number;
  fps: number;
  duration: number;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

export interface ExportResult {
  blob: Blob;
  ext: "mp4" | "webm";
  mode: "offline" | "realtime";
  hasAudio: boolean;
}

const H264 = ["avc1.640034", "avc1.640033", "avc1.64002A", "avc1.640028", "avc1.4D0028", "avc1.42E01F"];
const autoBitrate = (w: number, h: number, fps: number) => Math.min(40e6, Math.max(4e6, w * h * fps * 0.12));
const abortError = () => new DOMException("Export cancelled", "AbortError");

// Yield without setTimeout: timers are throttled to ~1/s in background tabs.
const tick = () =>
  new Promise<void>((resolve) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = () => { ch.port1.close(); resolve(); };
    ch.port2.postMessage(0);
  });

async function pickVideoConfig(width: number, height: number, fps: number): Promise<VideoEncoderConfig | null> {
  if (typeof VideoEncoder === "undefined" || typeof VideoFrame === "undefined") return null;
  for (const codec of H264) {
    const config: VideoEncoderConfig = { codec, width, height, bitrate: autoBitrate(width, height, fps), framerate: fps, avc: { format: "avc" } };
    try {
      if ((await VideoEncoder.isConfigSupported(config)).supported) return config;
    } catch { /* try the next profile */ }
  }
  return null;
}

async function pickAudioConfig(buffer: AudioBuffer | null): Promise<AudioEncoderConfig | null> {
  if (!buffer || typeof AudioEncoder === "undefined") return null;
  const config: AudioEncoderConfig = { codec: "mp4a.40.2", sampleRate: buffer.sampleRate, numberOfChannels: Math.min(2, buffer.numberOfChannels), bitrate: 128000 };
  try {
    return (await AudioEncoder.isConfigSupported(config)).supported ? config : null;
  } catch {
    return null;
  }
}

export const canExportOffline = async (width: number, height: number, fps: number) => !!(await pickVideoConfig(width, height, fps));

function makeEnv(o: ExportOptions): RenderEnv {
  return { width: o.width, height: o.height, assets: o.assets, time: 0, image: o.image ? prescale(o.image, o.width, o.height, o.scene.stage.fit) : null };
}

async function encodeOffline(o: ExportOptions, video: VideoEncoderConfig): Promise<ExportResult> {
  const { width, height, fps, duration } = o;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false })!;
  const env = makeEnv(o);
  const audio = await pickAudioConfig(o.narration);

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: "avc", width, height, frameRate: fps },
    audio: audio ? { codec: "aac", sampleRate: audio.sampleRate, numberOfChannels: audio.numberOfChannels } : undefined,
    fastStart: "in-memory",
  });

  let failure: unknown = null;
  const encoder = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => { failure = e; } });
  encoder.configure(video);

  const total = Math.max(1, Math.round(duration * fps));
  const frameUs = 1e6 / fps;
  try {
    for (let i = 0; i < total; i++) {
      if (o.signal?.aborted) throw abortError();
      if (failure) throw failure;
      env.time = i / fps;
      drawScene(ctx, o.scene, env);
      const frame = new VideoFrame(canvas, { timestamp: Math.round(i * frameUs), duration: Math.round(frameUs) });
      encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
      frame.close();
      while (encoder.encodeQueueSize > 6 && !failure) await tick();
      if (i % 4 === 0) {
        o.onProgress?.(((i + 1) / total) * 0.95);
        await tick();
      }
    }
    await encoder.flush();
    if (failure) throw failure;

    if (audio && o.narration) {
      const audioEncoder = new AudioEncoder({ output: (chunk, meta) => muxer.addAudioChunk(chunk, meta), error: (e) => { failure = e; } });
      audioEncoder.configure(audio);
      const { sampleRate, numberOfChannels } = audio;
      const frames = Math.min(o.narration.length, Math.floor(duration * sampleRate));
      const channels = Array.from({ length: numberOfChannels }, (_, c) => o.narration!.getChannelData(c));
      for (let offset = 0; offset < frames && !failure; offset += sampleRate) {
        const count = Math.min(sampleRate, frames - offset);
        const data = new Float32Array(count * numberOfChannels);
        channels.forEach((channel, c) => data.set(channel.subarray(offset, offset + count), c * count));
        const chunk = new AudioData({ format: "f32-planar", sampleRate, numberOfFrames: count, numberOfChannels, timestamp: Math.round((offset / sampleRate) * 1e6), data });
        audioEncoder.encode(chunk);
        chunk.close();
      }
      await audioEncoder.flush();
      audioEncoder.close();
      if (failure) throw failure;
    }
    muxer.finalize();
  } finally {
    if (encoder.state !== "closed") encoder.close();
  }
  o.onProgress?.(1);
  return { blob: new Blob([target.buffer], { type: "video/mp4" }), ext: "mp4", mode: "offline", hasAudio: !!audio };
}

// Real-time fallback for browsers without WebCodecs (no soundtrack).
async function encodeRealtime(o: ExportOptions): Promise<ExportResult> {
  if (typeof MediaRecorder === "undefined") throw new Error("This browser cannot export video.");
  const candidates: [string, "mp4" | "webm"][] = [["video/mp4;codecs=avc1", "mp4"], ["video/mp4", "mp4"], ["video/webm;codecs=vp9", "webm"], ["video/webm", "webm"]];
  const picked = candidates.find(([mime]) => MediaRecorder.isTypeSupported(mime));
  if (!picked) throw new Error("This browser cannot export video.");
  const canvas = document.createElement("canvas");
  canvas.width = o.width;
  canvas.height = o.height;
  const ctx = canvas.getContext("2d", { alpha: false })!;
  const env = makeEnv(o);
  drawScene(ctx, o.scene, env);
  const stream = canvas.captureStream(o.fps);
  const recorder = new MediaRecorder(stream, { mimeType: picked[0], videoBitsPerSecond: autoBitrate(o.width, o.height, o.fps) });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const stopped = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });
  recorder.start(250);
  const t0 = performance.now();
  await new Promise<void>((resolve, reject) => {
    const loop = () => {
      const t = (performance.now() - t0) / 1000;
      if (o.signal?.aborted) return reject(abortError());
      if (t >= o.duration) return resolve();
      env.time = t;
      drawScene(ctx, o.scene, env);
      o.onProgress?.(t / o.duration);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }).finally(() => {
    recorder.stop();
    stream.getTracks().forEach((track) => track.stop());
  });
  await stopped;
  o.onProgress?.(1);
  return { blob: new Blob(chunks, { type: picked[1] === "mp4" ? "video/mp4" : "video/webm" }), ext: picked[1], mode: "realtime", hasAudio: false };
}

export async function exportVideo(o: ExportOptions): Promise<ExportResult> {
  await preloadAssets(o.assets);
  const config = await pickVideoConfig(o.width, o.height, o.fps);
  return config ? encodeOffline(o, config) : encodeRealtime(o);
}

/** A single frame as PNG. `time` null = the editing view (everything visible, no animation). */
export async function exportPng(scene: Scene, assets: Record<string, Asset>, image: HTMLImageElement | null, width: number, height: number, time: number | null): Promise<Blob | null> {
  await preloadAssets(assets);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  drawScene(canvas.getContext("2d")!, scene, { width, height, assets, image, time });
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}
