'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { ImageSegmenter, FilesetResolver } from '@mediapipe/tasks-vision';

/**
 * useTeacherOverlay — MediaPipe background removal for teacher camera.
 *
 * Takes a hidden <video> element (teacher's camera track) and renders ONLY
 * the teacher's body (background removed) onto a <canvas>.
 *
 * Uses MediaPipe ImageSegmenter with selfie_multiclass model.
 * Processing happens per-frame via requestAnimationFrame.
 * Runs entirely in browser (WASM + GPU) — no server processing.
 */

// MediaPipe CDN base for the segmentation model
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite';

// WASM files served from /mediapipe/ (copied to public/ at build time)
const WASM_BASE_PATH = '/mediapipe';

interface UseTeacherOverlayOptions {
  /** Whether to start processing immediately */
  enabled?: boolean;
  /** Target FPS for processing (default: 30) */
  targetFps?: number;
  /** Edge smoothing passes (0 = none, 1-3 = smooth) */
  smoothing?: number;
}

interface UseTeacherOverlayReturn {
  /** Ref to attach to the hidden <video> element */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Ref to attach to the visible <canvas> element */
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  /** True once the segmentation model is loaded */
  isReady: boolean;
  /** True while the frame loop is processing */
  isProcessing: boolean;
  /** Current processing FPS (for diagnostics) */
  fps: number;
  /** Error message if model loading or processing fails */
  error: string | null;
  /** Manually start processing loop */
  start: () => void;
  /** Manually stop processing loop */
  stop: () => void;
}

export function useTeacherOverlay(
  options: UseTeacherOverlayOptions = {}
): UseTeacherOverlayReturn {
  const { enabled = true, targetFps = 30, smoothing = 1 } = options;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const segmenterRef = useRef<ImageSegmenter | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const fpsCounterRef = useRef<{ frames: number; lastCheck: number }>({ frames: 0, lastCheck: 0 });

  const [isReady, setIsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fps, setFps] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Load MediaPipe segmenter model
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    async function loadModel() {
      try {
        // Load WASM runtime
        const vision = await FilesetResolver.forVisionTasks(WASM_BASE_PATH);

        if (cancelled) return;

        // Create segmenter in VIDEO mode for per-frame processing
        const segmenter = await ImageSegmenter.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: 'GPU', // Use WebGL for acceleration; falls back to CPU
          },
          runningMode: 'VIDEO',
          outputCategoryMask: true,       // We need the category mask
          outputConfidenceMasks: false,    // Don't need confidence masks
        });

        if (cancelled) {
          segmenter.close();
          return;
        }

        segmenterRef.current = segmenter;
        setIsReady(true);
        setError(null);
        console.log('[useTeacherOverlay] Model loaded successfully');
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err);
          console.error('[useTeacherOverlay] Failed to load model:', message);
          setError(`Background removal not available: ${message}`);
        }
      }
    }

    loadModel();

    return () => {
      cancelled = true;
      if (segmenterRef.current) {
        segmenterRef.current.close();
        segmenterRef.current = null;
      }
      setIsReady(false);
    };
  }, [enabled]);

  // Frame processing function
  const processFrame = useCallback((timestamp: number) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const segmenter = segmenterRef.current;

    if (!video || !canvas || !segmenter || video.readyState < 2) {
      // Video not ready yet — keep trying
      rafRef.current = requestAnimationFrame(processFrame);
      return;
    }

    // Throttle to targetFps
    const frameInterval = 1000 / targetFps;
    if (timestamp - lastFrameTimeRef.current < frameInterval) {
      rafRef.current = requestAnimationFrame(processFrame);
      return;
    }
    lastFrameTimeRef.current = timestamp;

    // Ensure canvas matches video dimensions
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      rafRef.current = requestAnimationFrame(processFrame);
      return;
    }

    try {
      // Run segmentation on the current video frame
      const result = segmenter.segmentForVideo(video, timestamp);
      const categoryMask = result.categoryMask;

      if (!categoryMask) {
        // No mask available — draw frame as-is
        ctx.drawImage(video, 0, 0);
        result.close();
        rafRef.current = requestAnimationFrame(processFrame);
        return;
      }

      // Draw the original video frame
      ctx.drawImage(video, 0, 0);

      // Get the pixel data and mask data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imageData.data;
      const maskData = categoryMask.getAsFloat32Array();

      // Apply mask: in selfie_multiclass model, category 0 = background
      // Any non-zero category = person. Set background pixels to transparent.
      const maskWidth = categoryMask.width;
      const maskHeight = categoryMask.height;
      const scaleX = maskWidth / canvas.width;
      const scaleY = maskHeight / canvas.height;

      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          // Sample the mask at the corresponding position
          const mx = Math.floor(x * scaleX);
          const my = Math.floor(y * scaleY);
          const maskIndex = my * maskWidth + mx;
          const category = maskData[maskIndex];

          const pixelIndex = (y * canvas.width + x) * 4;

          if (category === 0) {
            // Background — make fully transparent
            pixels[pixelIndex + 3] = 0;
          } else if (smoothing > 0) {
            // Person — keep fully opaque, with edge smoothing
            // Check if this is an edge pixel (neighbor is background)
            let isEdge = false;
            for (let dy = -1; dy <= 1 && !isEdge; dy++) {
              for (let dx = -1; dx <= 1 && !isEdge; dx++) {
                const nx = mx + dx;
                const ny = my + dy;
                if (nx >= 0 && nx < maskWidth && ny >= 0 && ny < maskHeight) {
                  if (maskData[ny * maskWidth + nx] === 0) {
                    isEdge = true;
                  }
                }
              }
            }
            if (isEdge) {
              // Semi-transparent edges for smooth blending
              pixels[pixelIndex + 3] = 200;
            }
          }
        }
      }

      ctx.putImageData(imageData, 0, 0);
      result.close();

      // FPS counter
      fpsCounterRef.current.frames++;
      if (timestamp - fpsCounterRef.current.lastCheck >= 1000) {
        setFps(fpsCounterRef.current.frames);
        fpsCounterRef.current.frames = 0;
        fpsCounterRef.current.lastCheck = timestamp;
      }
    } catch (err) {
      // Non-fatal: skip this frame
      console.warn('[useTeacherOverlay] Frame processing error:', err);
    }

    rafRef.current = requestAnimationFrame(processFrame);
  }, [targetFps, smoothing]);

  // Start processing loop
  const start = useCallback(() => {
    if (rafRef.current) return; // already running
    setIsProcessing(true);
    fpsCounterRef.current = { frames: 0, lastCheck: performance.now() };
    rafRef.current = requestAnimationFrame(processFrame);
  }, [processFrame]);

  // Stop processing loop
  const stop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setIsProcessing(false);
    setFps(0);
  }, []);

  // Auto-start when model is ready and enabled
  useEffect(() => {
    if (isReady && enabled) {
      start();
    }
    return () => {
      stop();
    };
  }, [isReady, enabled, start, stop]);

  return {
    videoRef,
    canvasRef,
    isReady,
    isProcessing,
    fps,
    error,
    start,
    stop,
  };
}
