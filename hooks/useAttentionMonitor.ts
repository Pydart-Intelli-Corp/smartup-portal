// ═══════════════════════════════════════════════════════════════
// SmartUp Portal — AI Attention Monitor Hook
// ═══════════════════════════════════════════════════════════════
// Uses MediaPipe Face Detection on student's camera feed to detect
// if the student is looking at the screen (attentive) or not.
// Broadcasts attention score via LiveKit data channel.
// Also sends batched events to server monitoring API every 30s
// for coordinator/AO dashboards and report generation.
//
// Usage:
//   const { attentionScore, isAttentive } = useAttentionMonitor(videoEl, dataPublish, true, monitorConfig);
// ═══════════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

const WASM_BASE_PATH = '/mediapipe';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite';

// How often to run detection (ms)
const DETECTION_INTERVAL = 2000;

// How often to send batched monitoring events to server (ms)
const SERVER_SEND_INTERVAL = 30_000;

// Minimum face detection confidence to consider "attentive"
const FACE_CONFIDENCE_THRESHOLD = 0.65;

// Face must occupy at least this fraction of frame to count
const MIN_FACE_AREA_RATIO = 0.02;

export type MonitorEventType =
  | 'attentive'
  | 'looking_away'
  | 'eyes_closed'
  | 'not_in_frame'
  | 'low_engagement'
  | 'distracted';

export interface AttentionData {
  attentionScore: number;     // 0-100
  isAttentive: boolean;
  faceDetected: boolean;
  lastCheck: number;
  /** Current classified state for monitoring */
  monitorState?: MonitorEventType;
}

/** Config for server-side monitoring event tracking */
export interface MonitorConfig {
  roomId: string;
  sessionId?: string;
}

/** Internal tracking for batched server events */
interface MonitorEventBatch {
  event_type: MonitorEventType;
  confidence: number;
  duration_seconds: number;
}

export function useAttentionMonitor(
  videoElement: HTMLVideoElement | null,
  onAttentionUpdate?: (data: AttentionData) => void,
  enabled: boolean = true,
  monitorConfig?: MonitorConfig
) {
  const [attentionScore, setAttentionScore] = useState(100);
  const [isAttentive, setIsAttentive] = useState(true);
  const [faceDetected, setFaceDetected] = useState(true);
  const [monitorState, setMonitorState] = useState<MonitorEventType>('attentive');
  const detectorRef = useRef<FaceDetector | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const sendIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const scoresRef = useRef<number[]>([]);

  // Server monitoring: track current state and pending events
  const lastMonitorStateRef = useRef<MonitorEventType>('attentive');
  const lastMonitorStateStartRef = useRef<number>(Date.now());
  const pendingEventsRef = useRef<MonitorEventBatch[]>([]);

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

  // Classify detection into monitoring event type
  const classifyMonitorState = useCallback((
    faces: Array<{ categories?: Array<{ score: number }>; boundingBox?: { width: number; height: number } }>,
    score: number,
  ): MonitorEventType => {
    if (faces.length === 0) return 'not_in_frame';

    const face = faces[0];
    const confidence = face.categories?.[0]?.score || 0;

    if (confidence < 0.3) return 'not_in_frame';
    if (score < 20) return 'eyes_closed';
    if (score < 40) return 'looking_away';
    if (score < 60) return 'low_engagement';
    return 'attentive';
  }, []);

  // Send pending events to server monitoring API
  const sendMonitoringEvents = useCallback(async () => {
    if (!monitorConfig?.roomId) return;

    // Flush current state duration
    const now = Date.now();
    const currentDuration = Math.round((now - lastMonitorStateStartRef.current) / 1000);
    if (currentDuration > 0) {
      pendingEventsRef.current.push({
        event_type: lastMonitorStateRef.current,
        confidence: 85,
        duration_seconds: currentDuration,
      });
      lastMonitorStateStartRef.current = now;
    }

    const events = [...pendingEventsRef.current];
    if (events.length === 0) return;
    pendingEventsRef.current = [];

    try {
      await fetch('/api/v1/monitoring/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_id: monitorConfig.roomId,
          session_id: monitorConfig.sessionId,
          events,
        }),
      });
    } catch (err) {
      console.warn('[attention] Failed to send monitoring events:', err);
      // Retry: put back
      pendingEventsRef.current.unshift(...events);
    }
  }, [monitorConfig]);

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

      // Classify current monitoring state
      const curMonState = classifyMonitorState(faces, score);
      setMonitorState(curMonState);

      // Track state transitions for batched server events
      if (curMonState !== lastMonitorStateRef.current) {
        const durationSec = Math.round((Date.now() - lastMonitorStateStartRef.current) / 1000);
        if (durationSec > 0) {
          pendingEventsRef.current.push({
            event_type: lastMonitorStateRef.current,
            confidence: 85,
            duration_seconds: durationSec,
          });
        }
        lastMonitorStateRef.current = curMonState;
        lastMonitorStateStartRef.current = Date.now();
      }

      // Callback for broadcasting
      const data: AttentionData = {
        attentionScore: score,
        isAttentive: attentive,
        faceDetected: faces.length > 0,
        lastCheck: Date.now(),
        monitorState: curMonState,
      };
      onAttentionUpdate?.(data);
    } catch {
      // Silently skip detection errors
    }
  }, [videoElement, onAttentionUpdate, classifyMonitorState]);

  // Lifecycle
  useEffect(() => {
    if (!enabled || !videoElement) return;

    initDetector();

    intervalRef.current = setInterval(runDetection, DETECTION_INTERVAL);

    // Start server event batching if monitoring config is provided
    if (monitorConfig?.roomId) {
      sendIntervalRef.current = setInterval(sendMonitoringEvents, SERVER_SEND_INTERVAL);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (sendIntervalRef.current) clearInterval(sendIntervalRef.current);
      if (detectorRef.current) {
        detectorRef.current.close();
        detectorRef.current = null;
      }
      // Flush remaining events on cleanup
      sendMonitoringEvents();
    };
  }, [enabled, videoElement, initDetector, runDetection, monitorConfig, sendMonitoringEvents]);

  return { attentionScore, isAttentive, faceDetected, monitorState };
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
  monitorState?: MonitorEventType;
  timestamp: number;
}
