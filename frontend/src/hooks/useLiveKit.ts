import { useRef, useState, useEffect, useCallback } from "react";
import {
  Room,
  RoomEvent,
  RemoteTrack,
  RemoteTrackPublication,
  RemoteParticipant,
  Track,
  ConnectionState,
} from "livekit-client";

// Use same origin — Vite proxies /api to the backend
const API_BASE = import.meta.env.VITE_API_URL || "";

export interface PoseUpdate {
  type: "pose_update";
  landmarks: Array<{
    index: number;
    name: string;
    x: number;
    y: number;
    z: number;
    visibility: number;
  }> | null;
  connections?: number[][];
  bbox?: { x_min: number; y_min: number; x_max: number; y_max: number };
  organ_positions?: Record<string, number[]>;
  bone_positions?: Record<
    string,
    { start: number[]; end: number[]; midpoint: number[] }
  >;
  muscle_positions?: Record<
    string,
    { origin: number[]; insertion: number[]; midpoint: number[] }
  >;
  overlay_2d?: Record<string, { x: number; y: number; label: string }>;
  frame_width?: number;
  frame_height?: number;
  detected?: boolean;
  timestamp?: number;
}

export interface AgentLabel {
  organ: string;
  text: string;
  detail: string;
}

export interface AgentLabelsMessage {
  type: "agent_labels";
  labels: AgentLabel[];
  narration: string;
}

interface UseLiveKitReturn {
  room: Room | null;
  connectionState: ConnectionState;
  connect: (
    roomName: string,
    participantName: string,
    participantType: "phone" | "laptop"
  ) => Promise<void>;
  disconnect: () => void;
  remoteVideoTrack: RemoteTrack | null;
  remoteVideoElement: HTMLVideoElement | null;
  phoneConnected: boolean;
  lastPoseUpdate: PoseUpdate | null;
  lastAgentLabels: AgentLabelsMessage | null;
  sendData: (payload: object, topic: string) => void;
}

async function fetchToken(
  roomName: string,
  participantName: string,
  participantType: string
): Promise<{ token: string; livekit_url: string }> {
  const res = await fetch(`${API_BASE}/api/livekit/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      room_name: roomName,
      participant_name: participantName,
      participant_type: participantType,
    }),
  });
  if (!res.ok) throw new Error(`Token request failed: ${res.status}`);
  return res.json();
}

export function useLiveKit(): UseLiveKitReturn {
  const roomRef = useRef<Room | null>(null);
  const audioElementsRef = useRef<Set<HTMLMediaElement>>(new Set());
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    ConnectionState.Disconnected
  );
  const [remoteVideoTrack, setRemoteVideoTrack] = useState<RemoteTrack | null>(
    null
  );
  const [remoteVideoElement, setRemoteVideoElement] =
    useState<HTMLVideoElement | null>(null);
  const [phoneConnected, setPhoneConnected] = useState(false);
  const [lastPoseUpdate, setLastPoseUpdate] = useState<PoseUpdate | null>(null);
  const [lastAgentLabels, setLastAgentLabels] =
    useState<AgentLabelsMessage | null>(null);

  const connect = useCallback(
    async (
      roomName: string,
      participantName: string,
      participantType: "phone" | "laptop"
    ) => {
      const { token, livekit_url } = await fetchToken(
        roomName,
        participantName,
        participantType
      );

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      roomRef.current = room;

      room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
        setConnectionState(state);
      });

      // Track subscribed — video from phone or audio from agent
      room.on(
        RoomEvent.TrackSubscribed,
        (
          track: RemoteTrack,
          _publication: RemoteTrackPublication,
          participant: RemoteParticipant
        ) => {
          if (track.kind === Track.Kind.Video) {
            setRemoteVideoTrack(track);
            const el = track.attach() as HTMLVideoElement;
            el.style.width = "100%";
            el.style.height = "100%";
            el.style.objectFit = "contain";
            setRemoteVideoElement(el);
            if (participant.identity.startsWith("phone")) {
              setPhoneConnected(true);
            }
          }
          if (track.kind === Track.Kind.Audio) {
            const audioEl = track.attach();
            audioEl.style.display = "none";
            document.body.appendChild(audioEl);
            audioElementsRef.current.add(audioEl);
          }
        }
      );

      // Track unsubscribed
      room.on(
        RoomEvent.TrackUnsubscribed,
        (
          track: RemoteTrack,
          _publication: RemoteTrackPublication,
          participant: RemoteParticipant
        ) => {
          track.detach();
          if (track.kind === Track.Kind.Video) {
            setRemoteVideoTrack(null);
            setRemoteVideoElement(null);
            if (participant.identity.startsWith("phone")) {
              setPhoneConnected(false);
            }
          }
        }
      );

      // Participant disconnected
      room.on(
        RoomEvent.ParticipantDisconnected,
        (participant: RemoteParticipant) => {
          if (participant.identity.startsWith("phone")) {
            setPhoneConnected(false);
            setRemoteVideoTrack(null);
            setRemoteVideoElement(null);
          }
        }
      );

      // Data received from agent
      room.on(
        RoomEvent.DataReceived,
        (
          payload: Uint8Array,
          _participant?: RemoteParticipant,
          _kind?: unknown,
          topic?: string
        ) => {
          try {
            const text = new TextDecoder().decode(payload);
            const msg = JSON.parse(text);

            if (topic === "pose_update" || msg.type === "pose_update") {
              setLastPoseUpdate(msg as PoseUpdate);
            } else if (
              topic === "agent_labels" ||
              msg.type === "agent_labels"
            ) {
              setLastAgentLabels(msg as AgentLabelsMessage);
            }
          } catch {
            // Ignore parse errors
          }
        }
      );

      await room.connect(livekit_url, token);
      setConnectionState(ConnectionState.Connected);
    },
    []
  );

  const disconnect = useCallback(() => {
    // Clean up audio elements from DOM
    for (const el of audioElementsRef.current) {
      el.pause();
      el.remove();
    }
    audioElementsRef.current.clear();

    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    setConnectionState(ConnectionState.Disconnected);
    setRemoteVideoTrack(null);
    setRemoteVideoElement(null);
    setPhoneConnected(false);
    setLastPoseUpdate(null);
    setLastAgentLabels(null);
  }, []);

  const sendData = useCallback((payload: object, topic: string) => {
    if (roomRef.current?.state === ConnectionState.Connected) {
      const data = new TextEncoder().encode(JSON.stringify(payload));
      roomRef.current.localParticipant.publishData(data, {
        reliable: true,
        topic,
      });
    }
  }, []);

  useEffect(() => {
    return () => {
      roomRef.current?.disconnect();
    };
  }, []);

  return {
    room: roomRef.current,
    connectionState,
    connect,
    disconnect,
    remoteVideoTrack,
    remoteVideoElement,
    phoneConnected,
    lastPoseUpdate,
    lastAgentLabels,
    sendData,
  };
}
