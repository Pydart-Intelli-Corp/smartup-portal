// ═══════════════════════════════════════════════════════════════
// SmartUp Portal — AI Attention Monitor Hook
// ═══════════════════════════════════════════════════════════════
// Uses MediaPipe Face Detection on student's camera feed to detect
// if the student is looking at the screen (attentive) or not.
// Broadcasts attention score via LiveKit data channel.
//
// Usage:
//   const { attentionScore, isAttentive } = useAttentionMonitor(videoEl, dataPublish);
// ═══════════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

const WASM_BASE_PATH = '/mediapipe';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite';

// How often to run detection (ms)
const DETECTION_INTERVAL = 2000;

// Minimum face detection confidence to consider "attentive"
const FACE_CONFIDENCE_THRESHOLD = 0.65;

// Face must occupy at least this fraction of frame to count
const MIN_FACE_AREA_RATIO = 0.02;

export interface AttentionData {
  attentionScore: number;     // 0-100
  isAttentive: boolean;
  faceDetected: boolean;
  lastCheck: number;
}

export function useAttentionMonitor(
  videoElement: HTMLVideoElement | null,
  onAttentionUpdate?: (data: AttentionData) => void,
  enabled: boolean = true
) {
  const [attentionScore, setAttentionScore] = useState(100);
  const [isAttentive, setIsAttentive] = useState(true);
  const [faceDetected, setFaceDetected] = useState(true);
  const detectorRef = useRef<FaceDetector | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const scoresRef = useRef<number[]>([]);

  // Initialize detector
  const initDetector = useCallback(async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks(WASM_BASE_PATH);
      const detector = await FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_URL,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        minDetectionConfidence: 0.5,
      });
      detectorRef.current = detector;
    } catch (err) {
      console.warn('[attention] Failed to init face detector, falling back to no detection:', err);
    }
  }, []);

  // Run detection
  const runDetection = useCallback(() => {
    if (!detectorRef.current || !videoElement) return;
    if (videoElement.readyState < 2) return; // not enough data

    try {
      const result = detectorRef.current.detectForVideo(videoElement, Date.now());
      const faces = result.detections || [];

      if (faces.length === 0) {
        // No face detected — not attentive
        scoresRef.current.push(0);
        setFaceDetected(false);
      } else {
        // Check primary face
        const face = faces[0];
        const confidence = face.categories?.[0]?.score || 0;
        const bbox = face.boundingBox;

        // Calculate face area relative to frame
        let areaRatio = 1;
        if (bbox && videoElement.videoWidth > 0) {
          areaRatio = (bbox.width * bbox.height) / (videoElement.videoWidth * videoElement.videoHeight);
        }

        if (confidence >= FACE_CONFIDENCE_THRESHOLD && areaRatio >= MIN_FACE_AREA_RATIO) {
          scoresRef.current.push(100);
          setFaceDetected(true);
        } else {
          scoresRef.current.push(30); // partially attentive
          setFaceDetected(confidence >= 0.3);
        }
      }

      // Keep only last 30 samples (~60s at 2s interval)
      if (scoresRef.current.length > 30) {
        scoresRef.current = scoresRef.current.slice(-30);
      }

      // Calculate rolling average
      const avg = scoresRef.current.reduce((a, b) => a + b, 0) / scoresRef.current.length;
      const score = Math.round(avg);
      const attentive = score >= 50;

      setAttentionScore(score);
      setIsAttentive(attentive);

      // Callback for broadcasting
      const data: AttentionData = {
        attentionScore: score,
        isAttentive: attentive,
        faceDetected: faces.length > 0,
        lastCheck: Date.now(),
      };
      onAttentionUpdate?.(data);
    } catch (err) {
      // Silently skip detection errors
    }
  }, [videoElement, onAttentionUpdate]);

  // Lifecycle
  useEffect(() => {
    if (!enabled || !videoElement) return;

    initDetector();

    intervalRef.current = setInterval(runDetection, DETECTION_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (detectorRef.current) {
        detectorRef.current.close();
        detectorRef.current = null;
      }
    };
  }, [enabled, videoElement, initDetector, runDetection]);

  return { attentionScore, isAttentive, faceDetected };
}

// ── Attention data message type for data channel ────────────

export const ATTENTION_TOPIC = 'attention_update';

export interface AttentionMessage {
  type: 'attention_update';
  studentEmail: string;
  studentName: string;
  attentionScore: number;
  isAttentive: boolean;
  faceDetected: boolean;
  timestamp: number;
}
