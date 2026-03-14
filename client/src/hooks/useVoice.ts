import { useEffect, useRef, useState, useCallback } from 'react';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

interface PeerEntry {
  pc: RTCPeerConnection;
  email: string;
  username: string;
}

export interface VoiceState {
  currentChannel: string | null;
  muted: boolean;
  connecting: boolean;
  channelMembers: Record<string, Array<{ email: string; username: string }>>;
}

export function useVoice(socketManager: any, _userEmail: string) {
  const [state, setState] = useState<VoiceState>({
    currentChannel: null,
    muted: false,
    connecting: false,
    channelMembers: { General: [], Gaming: [], Music: [] },
  });

  // All mutable state lives in refs so event handlers are never stale
  const peersRef = useRef<Map<string, PeerEntry>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const speakerRef = useRef<string>('');
  const currentChannelRef = useRef<string | null>(null);

  // Hidden audio container kept in the DOM for the lifetime of the hook
  const audioContainerRef = useRef<HTMLDivElement | null>(null);
  const ensureContainer = () => {
    if (!audioContainerRef.current) {
      const div = document.createElement('div');
      div.style.cssText = 'position:fixed;width:0;height:0;overflow:hidden;';
      document.body.appendChild(div);
      audioContainerRef.current = div;
    }
    return audioContainerRef.current;
  };

  const sock = () => socketManager?.getSocket?.() ?? null;

  // ── Peer helpers ─────────────────────────────────────────────

  const closePeer = (socketId: string) => {
    const entry = peersRef.current.get(socketId);
    if (entry) {
      entry.pc.ontrack = null;
      entry.pc.onicecandidate = null;
      entry.pc.onconnectionstatechange = null;
      entry.pc.close();
      peersRef.current.delete(socketId);
    }
    // Remove audio element
    const container = audioContainerRef.current;
    container?.querySelector(`[data-peer="${socketId}"]`)?.remove();
  };

  const closeAllPeers = () => {
    peersRef.current.forEach((_, id) => closePeer(id));
  };

  const buildPC = (socketId: string, email: string, username: string): RTCPeerConnection => {
    // Tear down any existing connection for this peer first
    closePeer(socketId);

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Add our local audio tracks so the remote side hears us
    localStreamRef.current?.getTracks().forEach(t =>
      pc.addTrack(t, localStreamRef.current!)
    );

    // Forward ICE candidates via signaling channel
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        sock()?.emit('voiceSignal', {
          targetSocketId: socketId,
          signal: { type: 'ice', candidate: candidate.toJSON() },
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') pc.restartIce();
    };

    // Play remote audio
    pc.ontrack = ({ streams }) => {
      const stream = streams[0];
      if (!stream) return;
      const container = ensureContainer();
      // Remove any old audio for this peer
      container.querySelector(`[data-peer="${socketId}"]`)?.remove();
      const audio = document.createElement('audio');
      audio.dataset.peer = socketId;
      audio.autoplay = true;
      audio.srcObject = stream;
      if (speakerRef.current && 'setSinkId' in audio) {
        (audio as any).setSinkId(speakerRef.current).catch(() => {});
      }
      container.appendChild(audio);
    };

    peersRef.current.set(socketId, { pc, email, username });
    return pc;
  };

  // ── Socket signaling handler (stable — only registered once) ─

  useEffect(() => {
    const socket = sock();
    if (!socket) return;

    // ── voiceChannelsUpdated: refresh member list for everyone
    const onChannels = (channels: Record<string, Array<{ email: string; username: string }>>) => {
      setState(s => ({ ...s, channelMembers: channels }));
    };

    // ── voicePeerJoined: an existing member is told someone new joined.
    //    We do NOT pre-create a PC here — we wait for the joiner's offer.
    //    (No-op: just informational; the offer will arrive shortly.)
    const onPeerJoined = (_data: any) => { /* handled when offer arrives */ };

    // ── voicePeerLeft: remove that peer's connection
    const onPeerLeft = ({ socketId }: { socketId: string }) => {
      closePeer(socketId);
    };

    // ── voiceSignal: WebRTC signaling relay
    const onSignal = async ({ fromSocketId, signal }: { fromSocketId: string; signal: any }) => {
      const s = sock();
      if (!s) return;

      if (signal.type === 'offer') {
        // We are an existing member receiving the new joiner's offer.
        // Build (or rebuild) the peer connection for the joiner.
        const pc = buildPC(fromSocketId, '', '');
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          s.emit('voiceSignal', {
            targetSocketId: fromSocketId,
            signal: { type: 'answer', sdp: pc.localDescription },
          });
        } catch (err) {
          console.warn('[voice] offer handling error', err);
        }

      } else if (signal.type === 'answer') {
        // We are the joiner receiving an existing peer's answer.
        const entry = peersRef.current.get(fromSocketId);
        if (entry && entry.pc.signalingState !== 'stable') {
          try {
            await entry.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          } catch (err) {
            console.warn('[voice] answer handling error', err);
          }
        }

      } else if (signal.type === 'ice') {
        const entry = peersRef.current.get(fromSocketId);
        if (entry && signal.candidate) {
          try {
            await entry.pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } catch {}
        }
      }
    };

    socket.on('voiceChannelsUpdated', onChannels);
    socket.on('voicePeerJoined', onPeerJoined);
    socket.on('voicePeerLeft', onPeerLeft);
    socket.on('voiceSignal', onSignal);

    // Initial channel state
    socket.emit('getVoiceChannels', (res: any) => {
      if (res?.ok) setState(s => ({ ...s, channelMembers: res.channels }));
    });

    return () => {
      socket.off('voiceChannelsUpdated', onChannels);
      socket.off('voicePeerJoined', onPeerJoined);
      socket.off('voicePeerLeft', onPeerLeft);
      socket.off('voiceSignal', onSignal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socketManager]); // only re-run if socketManager itself is replaced

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      sock()?.emit('leaveVoiceChannel', () => {});
      closeAllPeers();
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
      audioContainerRef.current?.remove();
      audioContainerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Public API ────────────────────────────────────────────────

  const joinChannel = useCallback(async (channelId: string, micDeviceId?: string) => {
    const socket = sock();
    if (!socket) return;

    setState(s => ({ ...s, connecting: true }));

    // Leave current channel first
    if (currentChannelRef.current) {
      socket.emit('leaveVoiceChannel', () => {});
      closeAllPeers();
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }

    // Request microphone
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: micDeviceId ? { deviceId: { exact: micDeviceId } } : true,
        video: false,
      });
    } catch {
      setState(s => ({ ...s, connecting: false }));
      throw new Error('mic-denied');
    }
    localStreamRef.current = stream;

    // Tell server we're joining
    socket.emit('joinVoiceChannel', { channelId }, async (res: any) => {
      if (!res?.ok) {
        stream.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
        setState(s => ({ ...s, connecting: false }));
        return;
      }

      currentChannelRef.current = channelId;
      setState(s => ({ ...s, currentChannel: channelId, connecting: false }));

      // As the NEW JOINER we initiate offers to every EXISTING peer
      for (const peer of (res.existingPeers ?? [])) {
        const pc = buildPC(peer.socketId, peer.email, peer.username);
        try {
          const offer = await pc.createOffer({ offerToReceiveAudio: true });
          await pc.setLocalDescription(offer);
          socket.emit('voiceSignal', {
            targetSocketId: peer.socketId,
            signal: { type: 'offer', sdp: pc.localDescription },
          });
        } catch (err) {
          console.warn('[voice] createOffer error', err);
        }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socketManager]);

  const leaveChannel = useCallback(() => {
    sock()?.emit('leaveVoiceChannel', () => {});
    closeAllPeers();
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    currentChannelRef.current = null;
    setState(s => ({ ...s, currentChannel: null, muted: false, connecting: false }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socketManager]);

  const toggleMute = useCallback(() => {
    const tracks = localStreamRef.current?.getAudioTracks() ?? [];
    const nowEnabled = tracks[0]?.enabled ?? true;
    tracks.forEach(t => { t.enabled = !nowEnabled; });
    setState(s => ({ ...s, muted: nowEnabled }));
  }, []);

  const setMicDevice = useCallback(async (deviceId: string) => {
    if (!localStreamRef.current) return;
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
        video: false,
      });
      const [newTrack] = newStream.getAudioTracks();
      peersRef.current.forEach(({ pc }) => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
        if (sender && newTrack) sender.replaceTrack(newTrack).catch(() => {});
      });
      localStreamRef.current.getAudioTracks().forEach(t => t.stop());
      localStreamRef.current = newStream;
    } catch {}
  }, []);

  const applySpeaker = useCallback((deviceId: string) => {
    speakerRef.current = deviceId;
    audioContainerRef.current?.querySelectorAll('audio').forEach(el => {
      if ('setSinkId' in el) (el as any).setSinkId(deviceId).catch(() => {});
    });
  }, []);

  return { ...state, joinChannel, leaveChannel, toggleMute, setMicDevice, applySpeaker };
}
