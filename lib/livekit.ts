import {
  RoomServiceClient,
  AccessToken,
  WebhookReceiver,
  type VideoGrant,
} from 'livekit-server-sdk';
import type { PortalRole } from '@/types';

/**
 * LiveKit server utilities.
 * Uses LIVEKIT_API_KEY + LIVEKIT_API_SECRET from environment.
 * These are server-side only — never import this in client components.
 */

const livekitHost =
  process.env.NEXT_PUBLIC_LIVEKIT_URL?.replace('ws://', 'http://').replace('wss://', 'https://') ||
  'http://localhost:7880';
const apiKey = process.env.LIVEKIT_API_KEY!;
const apiSecret = process.env.LIVEKIT_API_SECRET!;

// ── Room Service Client (admin operations) ──────────────────
export const roomService = new RoomServiceClient(livekitHost, apiKey, apiSecret);

// ── Webhook Receiver (verify LiveKit signatures) ────────────
export const webhookReceiver = new WebhookReceiver(apiKey, apiSecret);

// ── Role-based LiveKit grants ───────────────────────────────
// See 04_API_ROUTES.md §4.1 for grant matrix
// hidden: true is a real LiveKit server-enforced field — hides participant from all lists
const GRANTS: Record<PortalRole, VideoGrant> = {
  teacher: {
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
    hidden: false,
    roomAdmin: true,
    roomRecord: true,
  },
  teacher_screen: {
    // Teacher's tablet/screen device — can only screen share, no camera/mic
    roomJoin: true,
    canPublish: true,           // needs to publish screen share track
    canPublishSources: [3, 4],  // TrackSource.SCREEN_SHARE = 3, SCREEN_SHARE_AUDIO = 4
    canPublishData: false,
    canSubscribe: false,        // doesn't need to receive tracks
    hidden: false,              // students need to see this to get the screen share
    roomAdmin: false,
  },
  student: {
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
    hidden: false,
  },
  coordinator: {
    roomJoin: true,
    canPublish: false,
    canPublishData: false, // ghost: no chat messages
    canSubscribe: true,
    hidden: true,
  },
  academic_operator: {
    roomJoin: true,
    canPublish: false,
    canPublishData: false,
    canSubscribe: true,
    hidden: true,
  },
  academic: {
    roomJoin: true,
    canPublish: false,
    canPublishData: false,
    canSubscribe: true,
    hidden: true,
  },
  parent: {
    roomJoin: true,
    canPublish: false,
    canPublishData: false,
    canSubscribe: true,
    hidden: true, // parents are ghost observers
  },
  hr: {
    roomJoin: false,
    canPublish: false,
    canPublishData: false,
    canSubscribe: false,
    hidden: true, // HR does not join classrooms
  },
  owner: {
    roomJoin: true,
    canPublish: false,
    canPublishData: false,
    canSubscribe: true,
    hidden: true,
  },
  ghost: {
    roomJoin: true,
    canPublish: false,
    canPublishData: false,
    canSubscribe: true,
    hidden: true,
  },
};

/**
 * Create a LiveKit access token for a participant.
 * Grants are determined by role from the GRANTS matrix.
 */
export async function createLiveKitToken(options: {
  roomName: string;
  participantIdentity: string;
  participantName: string;
  role: PortalRole;
  metadata?: string;
  ttl?: string;
}): Promise<string> {
  const { roomName, participantIdentity, participantName, role, metadata, ttl } = options;
  const grant: VideoGrant = { ...GRANTS[role], room: roomName };

  const token = new AccessToken(apiKey, apiSecret, {
    identity: participantIdentity,
    name: participantName,
    ttl: ttl || '4h',
    metadata,
  });
  token.addGrant(grant);

  return await token.toJwt();
}

// Keep the old function as an alias for backward compat
export async function createRoomToken(
  roomName: string,
  identity: string,
  name: string,
  role: PortalRole
): Promise<string> {
  return createLiveKitToken({
    roomName,
    participantIdentity: identity,
    participantName: name,
    role,
  });
}

/**
 * Ensure a LiveKit room exists. Idempotent — safe to call multiple times.
 * Returns the room object.
 */
export async function ensureRoom(
  roomName: string,
  metadata?: string
): Promise<{ name: string; sid: string }> {
  const rooms = await roomService.listRooms([roomName]);
  if (rooms.length > 0) {
    return { name: rooms[0].name, sid: rooms[0].sid };
  }

  const room = await roomService.createRoom({
    name: roomName,
    emptyTimeout: 300, // 5 min
    maxParticipants: 210,
    metadata,
  });

  return { name: room.name, sid: room.sid };
}

/**
 * Delete a LiveKit room. Used when teacher ends the class.
 */
export async function deleteRoom(roomName: string): Promise<void> {
  await roomService.deleteRoom(roomName);
}

/**
 * List current participants in a room (excludes hidden by default).
 */
export async function listParticipants(roomName: string) {
  return roomService.listParticipants(roomName);
}

/**
 * Test LiveKit connectivity. Creates a test room, lists it, deletes it.
 * Returns step-by-step results.
 */
export async function testLiveKitConnectivity(): Promise<{
  steps: { name: string; pass: boolean; error?: string }[];
  reachable: boolean;
}> {
  const testRoom = 'dev_ping_room';
  const steps: { name: string; pass: boolean; error?: string }[] = [];

  // Step 1: Create test room
  try {
    await roomService.createRoom({ name: testRoom, emptyTimeout: 10 });
    steps.push({ name: 'Create test room', pass: true });
  } catch (e) {
    steps.push({ name: 'Create test room', pass: false, error: String(e) });
    return { steps, reachable: false };
  }

  // Step 2: List rooms to verify it exists
  try {
    const rooms = await roomService.listRooms([testRoom]);
    const found = rooms.some((r) => r.name === testRoom);
    steps.push({ name: 'List rooms (verify exists)', pass: found, error: found ? undefined : 'Room not found in list' });
  } catch (e) {
    steps.push({ name: 'List rooms (verify exists)', pass: false, error: String(e) });
  }

  // Step 3: Delete test room
  try {
    await roomService.deleteRoom(testRoom);
    steps.push({ name: 'Delete test room', pass: true });
  } catch (e) {
    steps.push({ name: 'Delete test room', pass: false, error: String(e) });
  }

  // Step 4: Generate a test token
  try {
    const token = await createLiveKitToken({
      roomName: 'test_room',
      participantIdentity: 'test_user',
      participantName: 'Test User',
      role: 'student',
      ttl: '30s',
    });
    steps.push({ name: 'Generate test token', pass: !!token });
  } catch (e) {
    steps.push({ name: 'Generate test token', pass: false, error: String(e) });
  }

  return { steps, reachable: steps.every((s) => s.pass) };
}

/**
 * Generate ghost identity string.
 * Format: ghost_{role}_{sanitised_name}_{unix_timestamp}
 */
export function ghostIdentity(role: PortalRole, userName: string): string {
  const sanitised = userName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
  return `ghost_${role}_${sanitised}_${Math.floor(Date.now() / 1000)}`;
}

/**
 * Check if a role gets ghost (hidden) grants.
 */
export function isHiddenRole(role: PortalRole): boolean {
  return GRANTS[role]?.hidden === true;
}
