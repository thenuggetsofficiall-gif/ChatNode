import { useEffect, useRef, useState, useCallback } from 'react';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

interface PeerEntry {
  socketId: string;
  email: string;
  username: string;
  pc: RTCPeerConnection;
}

export interface VoiceState {
  currentChannel: string | null;
  muted: boolean;
  connecting: boolean;
  channelMembers: Record<string, Array<{ email: string; username: string }>>;
}

export function useVoice(socketManager: any, userEmail: string) {
  const [state, setState] = useState<VoiceState>({
    currentChannel: null,
    muted: false,
    connecting: false,
    channelMembers: { General: [], Gaming: [], Music: [] },
  });

  // Use refs so callbacks always have latest values without stale closures
  const peersRef = useRef<Map<string, PeerEntry>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const speakerDeviceRef = useRef<string>('');
  // Hidden audio container mounted once
  const audioContainerRef = useRef<HTMLDivElement | null>(null);

  // Ensure hidden audio container exists in DOM
  const getAudioContainer = useCallback(() => {
    if (!audioContainerRef.current) {
      const div = document.createElement('div');
      div.style.display = 'none';
      div.id = 'voice-audio-container';
      document.body.appendChild(div);
      audioContainerRef.current = div;
    }
    return audioContainerRef.current;
  }, []);

  const getSocket = useCallback(() => socketManager?.getSocket?.() ?? null, [socketManager]);

  const attachRemoteStream = useCallback((socketId: string, stream: MediaStream) => {
    const container = getAudioContainer();
    // Remove existing audio for this peer
    const old = container.querySelector(`[data-peer="${socketId}"]`);
    if (old) old.remove();

    const audio = document.createElement('audio');
    audio.autoplay = true;
    audio.dataset.peer = socketId;
    audio.srcObject = stream;
    if (speakerDeviceRef.current && 'setSinkId' in audio) {
      (audio as any).setSinkId(speakerDeviceRef.current).catch(() => {});
    }
    container.appendChild(audio);
    audio.play().catch(() => {});
  }, [getAudioContainer]);

  const removePeerAudio = useCallback((socketId: string) => {
    const container = audioContainerRef.current;
    if (!container) return;
    const el = container.querySelector(`[data-peer="${socketId}"]`);
    if (el) el.remove();
  }, []);

  const removePeer = useCallback((socketId: string) => {
    const peer = peersRef.current.get(socketId);
    if (peer) {
      peer.pc.close();
      peersRef.current.delete(socketId);
    }
    removePeerAudio(socketId);
  }, [removePeerAudio]);

  const stopLocalStream = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
  }, []);

  const createPC = useCallback((socketId: string, email: string, username: string): RTCPeerConnection => {
    // Close any existing connection for this peer
    const existing = peersRef.current.get(socketId);
    if (existing) {
      existing.pc.close();
      peersRef.current.delete(socketId);
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Add local audio tracks
    localStreamRef.current?.getTracks().forEach(t => {
      pc.addTrack(t, localStreamRef.current!);
    });

    // Relay ICE candidates
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        getSocket()?.emit('voiceSignal', {
          targetSocketId: socketId,
          signal: { type: 'ice', candidate: e.candidate.toJSON() },
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        pc.restartIce();
      }
    };

    pc.ontrack = (e) => {
      if (e.streams && e.streams[0]) {
        attachRemoteStream(socketId, e.streams[0]);
      }
    };

    peersRef.current.set(socketId, { socketId, email, username, pc });
    return pc;
  }, [getSocket, attachRemoteStream]);

  // ── Public actions ─────────────────────────────────────────

  const leaveChannel = useCallback(() => {
    getSocket()?.emit('leaveVoiceChannel', () => {});
    peersRef.current.forEach((_, id) => removePeer(id));
    peersRef.current.clear();
    stopLocalStream();
    setState(s => ({ ...s, currentChannel: null, muted: false, connecting: false }));
  }, [getSocket, removePeer, stopLocalStream]);

  const joinChannel = useCallback(async (channelId: string, micDeviceId?: string) => {
    const socket = getSocket();
    if (!socket) return;

    setState(s => ({ ...s, connecting: true }));

    // Leave any current channel first
    if (peersRef.current.size > 0) {
      socket.emit('leaveVoiceChannel', () => {});
      peersRef.current.forEach((_, id) => removePeer(id));
      peersRef.current.clear();
      stopLocalStream();
    }

    // Get microphone
    let stream: MediaStream;
    try {
      const constraints: MediaStreamConstraints = {
        audio: micDeviceId ? { deviceId: { exact: micDeviceId } } : true,
        video: false,
      };
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch {
      setState(s => ({ ...s, connecting: false }));
      throw new Error('mic-denied');
    }

    localStreamRef.current = stream;

    socket.emit('joinVoiceChannel', { channelId }, async (res: any) => {
      if (!res?.ok) {
        stopLocalStream();
        setState(s => ({ ...s, connecting: false }));
        return;
      }

      setState(s => ({ ...s, currentChannel: channelId, connecting: false }));

      // As the new joiner, create offers to every existing peer
      for (const peer of (res.existingPeers || [])) {
        const pc = createPC(peer.socketId, peer.email, peer.username);
        try {
          const offer = await pc.createOffer({ offerToReceiveAudio: true });
          await pc.setLocalDescription(offer);
          socket.emit('voiceSignal', {
            targetSocketId: peer.socketId,
            signal: { type: 'offer', sdp: pc.localDescription },
          });
        } catch {}
      }
    });
  }, [getSocket, createPC, removePeer, stopLocalStream]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const tracks = stream.getAudioTracks();
    const nowMuted = tracks[0]?.enabled ?? false; // will flip
    tracks.forEach(t => { t.enabled = !t.enabled; });
    setState(s => ({ ...s, muted: !s.muted }));
  }, []);

  const setMicDevice = useCallback(async (deviceId: string) => {
    if (!localStreamRef.current) return;
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
        video: false,
      });
      const [newTrack] = newStream.getAudioTracks();
      peersRef.current.forEach(peer => {
        const sender = peer.pc.getSenders().find(s => s.track?.kind === 'audio');
        if (sender && newTrack) sender.replaceTrack(newTrack).catch(() => {});
      });
      localStreamRef.current.getAudioTracks().forEach(t => t.stop());
      localStreamRef.current = newStream;
    } catch {}
  }, []);

  const applySpeaker = useCallback((deviceId: string) => {
    speakerDeviceRef.current = deviceId;
    const container = audioContainerRef.current;
    if (!container) return;
    container.querySelectorAll('audio').forEach(el => {
      if ('setSinkId' in el) (el as any).setSinkId(deviceId).catch(() => {});
    });
  }, []);

  // ── Socket event listeners ─────────────────────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onChannelsUpdated = (channels: Record<string, Array<{ email: string; username: string }>>) => {
      setState(s => ({ ...s, channelMembers: channels }));
    };

    const onPeerJoined = ({ socketId, email, username }: any) => {
      // Existing member: create a PC ready to receive the offer from the new joiner
      if (!peersRef.current.has(socketId) && localStreamRef.current) {
        createPC(socketId, email, username);
      }
    };

    const onPeerLeft = ({ socketId }: any) => {
      removePeer(socketId);
    };

    const onSignal = async ({ fromSocketId, signal }: any) => {
      const socket = getSocket();
      if (!socket) return;

      if (signal.type === 'offer') {
        // Create or reuse a PC for this peer
        const pc = createPC(fromSocketId, '', '');
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('voiceSignal', {
            targetSocketId: fromSocketId,
            signal: { type: 'answer', sdp: pc.localDescription },
          });
        } catch {}
      } else if (signal.type === 'answer') {
        const peer = peersRef.current.get(fromSocketId);
        if (peer && peer.pc.signalingState !== 'stable') {
          try {
            await peer.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          } catch {}
        }
      } else if (signal.type === 'ice') {
        const peer = peersRef.current.get(fromSocketId);
        if (peer && signal.candidate) {
          try {
            await peer.pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } catch {}
        }
      }
    };

    socket.on('voiceChannelsUpdated', onChannelsUpdated);
    socket.on('voicePeerJoined', onPeerJoined);
    socket.on('voicePeerLeft', onPeerLeft);
    socket.on('voiceSignal', onSignal);

    // Load initial channel state
    socket.emit('getVoiceChannels', (res: any) => {
      if (res?.ok && res.channels) {
        setState(s => ({ ...s, channelMembers: res.channels }));
      }
    });

    return () => {
      socket.off('voiceChannelsUpdated', onChannelsUpdated);
      socket.off('voicePeerJoined', onPeerJoined);
      socket.off('voicePeerLeft', onPeerLeft);
      socket.off('voiceSignal', onSignal);
    };
  }, [socketManager, getSocket, createPC, removePeer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      getSocket()?.emit('leaveVoiceChannel', () => {});
      peersRef.current.forEach((_, id) => {
        peersRef.current.get(id)?.pc.close();
        removePeerAudio(id);
      });
      peersRef.current.clear();
      stopLocalStream();
      audioContainerRef.current?.remove();
      audioContainerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { ...state, joinChannel, leaveChannel, toggleMute, setMicDevice, applySpeaker };
}
