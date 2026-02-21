'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  useLocalParticipant,
  useDataChannel,
} from '@livekit/components-react';
import { cn, fmtTimeIST } from '@/lib/utils';

/**
 * ChatPanel — Realtime chat via LiveKit data channel.
 * Uses topic 'chat' for message exchange.
 * Teacher messages: right-aligned blue bubble.
 * Student/other messages: left-aligned grey bubble.
 */

export interface ChatPanelProps {
  participantName: string;
  participantRole: string;
  onClose?: () => void;
  className?: string;
}

interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  role: string;
  timestamp: string;
  isLocal: boolean;
}

export default function ChatPanel({
  participantName,
  participantRole,
  onClose,
  className,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { localParticipant } = useLocalParticipant();

  // Handle incoming messages
  const onDataReceived = useCallback(
    (msg: { payload: Uint8Array; from?: { identity: string } }) => {
      try {
        const text = new TextDecoder().decode(msg.payload);
        const data = JSON.parse(text) as {
          sender: string;
          text: string;
          role: string;
          timestamp: string;
        };
        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
            sender: data.sender,
            text: data.text,
            role: data.role,
            timestamp: data.timestamp,
            isLocal: false,
          },
        ]);
      } catch {
        // ignore malformed messages
      }
    },
    []
  );

  useDataChannel('chat', onDataReceived);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text) return;

    const msg = {
      sender: participantName,
      text,
      role: participantRole,
      timestamp: new Date().toISOString(),
    };

    // Publish via data channel
    try {
      const bytes = new TextEncoder().encode(JSON.stringify(msg));
      await localParticipant.publishData(bytes, { topic: 'chat', reliable: true });

      // Add to local messages
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}_local`,
          ...msg,
          isLocal: true,
        },
      ]);
      setInput('');
    } catch (err) {
      console.error('Failed to send chat message:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (iso: string) => {
    try {
      return fmtTimeIST(iso);
    } catch {
      return '';
    }
  };

  return (
    <div className={cn('flex h-full flex-col bg-gray-900', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 px-3 py-2">
        <span className="text-sm font-medium text-white">Class Chat</span>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-sm"
          >
            ✕
          </button>
        )}
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-xs text-gray-500 mt-8">
            No messages yet. Say hello!
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn('flex flex-col', msg.isLocal ? 'items-end' : 'items-start')}
          >
            <div className="flex items-baseline gap-1.5 mb-0.5">
              <span className="text-xs font-medium text-gray-400">
                {msg.isLocal ? 'You' : msg.sender}
              </span>
              {!msg.isLocal && msg.role && (
                <span className="text-[10px] uppercase text-gray-500">
                  ({msg.role})
                </span>
              )}
              <span className="text-[10px] text-gray-600">
                {formatTime(msg.timestamp)}
              </span>
            </div>
            <div
              className={cn(
                'max-w-[85%] rounded-lg px-3 py-1.5 text-sm',
                msg.isLocal
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-200'
              )}
            >
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      {/* Input area */}
      <div className="border-t border-gray-800 px-3 py-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 rounded-lg bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-blue-500"
            maxLength={500}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim()}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}
