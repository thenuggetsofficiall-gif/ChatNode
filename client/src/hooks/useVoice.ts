import { useEffect, useRef, useState, useCallback } from 'react';

// Include TURN servers for reliable traversal behind NAT
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'turn:openrelay.metered.ca:80',    username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443',   username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
];

export interface VoiceMember {
  email: string;
  username: string;
  serverMuted: boolean;
  speaking: boolean;
}

export interface VoiceState {
  currentChannel: string | null;
  muted: boolean;
  deafened: boolean;
  serverMuted: boolean;
  connecting: boolean;
  speaking: boolean;
  channelMembers: Record<string, VoiceMember[]>;
}

export function useVoice(socketManager: any, userEmail: string) {
  const [state, setState] = useState<VoiceState>({
    currentChannel: null,
    muted: false,
    deafened: false,
    serverMuted: false,
    connecting: false,
    speaking: false,
    channelMembers: { General: [], Gaming: [], Music: [] },
  });

  // All mutable state in refs — event handlers are NEVER stale
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const speakerRef = useRef<string>('');
  const deafenedRef = useRef(false);
  const serverMutedRef = useRef(false);
  const currentChannelRef = useRef<string | null>(null);
  const speakingRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const speakingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Hidden audio container stays in DOM for lifetime of hook
  const audioContainerRef = useRef<HTMLDivElement | null>(null);
  const ensureAudioContainer = () => {
    if (!audioContainerRef.current) {
      const div = document.createElement('div');
      div.style.cssText = 'position:fixed;width:0;height:0;overflow:hidden;pointer-events:none;';
      div.id = 'vc-audio-root';
      document.body.appendChild(div);
      audioContainerRef.current = div;
    }
    return audioContainerRef.current;
  };

  const sock = () => socketManager?.getSocket?.() ?? null;

  // ── Peer helpers ─────────────────────────────────────────────

  const removePeer = useCallback((socketId: string) => {
    const pc = peersRef.current.get(socketId);
    if (pc) {
      pc.ontrack = null; pc.onicecandidate = null; pc.onconnectionstatechange = null;
      pc.close();
      peersRef.current.delete(socketId);
    }
    audioContainerRef.current?.querySelector(`[data-peer="${socketId}"]`)?.remove();
  }, []);

  const closeAllPeers = useCallback(() => {
    peersRef.current.forEach((_, id) => removePeer(id));
  }, [removePeer]);

  const buildPC = useCallback((socketId: string): RTCPeerConnection => {
    // Tear down any existing connection first
    const existing = peersRef.current.get(socketId);
    if (existing) {
      existing.ontrack = null; existing.onicecandidate = null; existing.onconnectionstatechange = null;
      existing.close();
      peersRef.current.delete(socketId);
      audioContainerRef.current?.querySelector(`[data-peer="${socketId}"]`)?.remove();
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Add our local tracks
    localStreamRef.current?.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current!));

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        sock()?.emit('voiceSignal', { targetSocketId: socketId, signal: { type: 'ice', candidate: candidate.toJSON() } });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') pc.restartIce();
    };

    pc.ontrack = ({ streams }) => {
      const stream = streams[0];
      if (!stream) return;
      const container = ensureAudioContainer();
      container.querySelector(`[data-peer="${socketId}"]`)?.remove();
      const audio = document.createElement('audio');
      audio.dataset.peer = socketId;
      audio.autoplay = true;
      (audio as any).playsInline = true;
      audio.srcObject = stream;
      audio.muted = deafenedRef.current;
      if (speakerRef.current && 'setSinkId' in audio) {
        (audio as any).setSinkId(speakerRef.current).catch(() => {});
      }
      container.appendChild(audio);
      // Explicitly call play() — autoplay attr alone is blocked by browser policy
      // when the ontrack fires asynchronously outside the user-gesture chain
      audio.play().catch(() => {
        // If blocked, retry on next user interaction
        const retry = () => { audio.play().catch(() => {}); document.removeEventListener('click', retry); };
        document.addEventListener('click', retry, { once: true });
      });
    };

    peersRef.current.set(socketId, pc);
    return pc;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Speaking detection ───────────────────────────────────────

  const startSpeakingDetection = useCallback((stream: MediaStream) => {
    try {
      const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      const ctx = new AudioCtx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.3;
      ctx.createMediaStreamSource(stream).connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      let lastSpeak = false;
      speakingTimerRef.current = setInterval(() => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        const speaking = avg > 12;
        if (speaking !== lastSpeak) {
          lastSpeak = speaking;
          speakingRef.current = speaking;
          setState(s => ({ ...s, speaking }));
          sock()?.emit('voiceSpeaking', { speaking });
        }
      }, 80);
    } catch {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stopSpeakingDetection = useCallback(() => {
    if (speakingTimerRef.current) { clearInterval(speakingTimerRef.current); speakingTimerRef.current = null; }
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
  }, []);

  // ── Socket event listeners (stable — only bound once) ────────

  useEffect(() => {
    const socket = sock();
    if (!socket) return;

    const onChannels = (channels: Record<string, VoiceMember[]>) => {
      setState(s => ({ ...s, channelMembers: channels }));
    };

    const onPeerJoined = (_: any) => { /* joiner will send us an offer — we wait */ };

    const onPeerLeft = ({ socketId }: { socketId: string }) => {
      removePeer(socketId);
    };

    const onSignal = async ({ fromSocketId, signal }: { fromSocketId: string; signal: any }) => {
      const s = sock();
      if (!s) return;

      if (signal.type === 'offer') {
        const pc = buildPC(fromSocketId);
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          s.emit('voiceSignal', { targetSocketId: fromSocketId, signal: { type: 'answer', sdp: pc.localDescription } });
        } catch (e) { console.warn('[VC] offer err', e); }

      } else if (signal.type === 'answer') {
        const pc = peersRef.current.get(fromSocketId);
        if (pc && pc.signalingState !== 'stable') {
          try { await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp)); }
          catch (e) { console.warn('[VC] answer err', e); }
        }

      } else if (signal.type === 'ice') {
        const pc = peersRef.current.get(fromSocketId);
        if (pc && signal.candidate) {
          try { await pc.addIceCandidate(new RTCIceCandidate(signal.candidate)); } catch {}
        }
      }
    };

    const onKicked = () => {
      // Server kicked us — clean up and notify UI
      closeAllPeers();
      stopSpeakingDetection();
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
      currentChannelRef.current = null;
      setState(s => ({ ...s, currentChannel: null, muted: false, deafened: false, serverMuted: false, connecting: false, speaking: false }));
    };

    const onServerMuted = ({ muted }: { muted: boolean }) => {
      serverMutedRef.current = muted;
      // Silence local tracks if server-muted (they can't unmute themselves)
      localStreamRef.current?.getAudioTracks().forEach(t => { if (muted) t.enabled = false; });
      setState(s => ({ ...s, serverMuted: muted, muted: muted ? true : s.muted }));
    };

    socket.on('voiceChannelsUpdated', onChannels);
    socket.on('voicePeerJoined', onPeerJoined);
    socket.on('voicePeerLeft', onPeerLeft);
    socket.on('voiceSignal', onSignal);
    socket.on('voiceKicked', onKicked);
    socket.on('voiceServerMuted', onServerMuted);

    // Initial state load
    socket.emit('getVoiceChannels', (res: any) => {
      if (res?.ok) setState(s => ({ ...s, channelMembers: res.channels }));
    });

    return () => {
      socket.off('voiceChannelsUpdated', onChannels);
      socket.off('voicePeerJoined', onPeerJoined);
      socket.off('voicePeerLeft', onPeerLeft);
      socket.off('voiceSignal', onSignal);
      socket.off('voiceKicked', onKicked);
      socket.off('voiceServerMuted', onServerMuted);
    };
  }, [socketManager]); // eslint-disable-line react-hooks/exhaustive-deps

  // Unmount cleanup
  useEffect(() => {
    return () => {
      sock()?.emit('leaveVoiceChannel', () => {});
      closeAllPeers();
      stopSpeakingDetection();
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
      audioContainerRef.current?.remove();
      audioContainerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Public API ────────────────────────────────────────────────

  const joinChannel = useCallback(async (channelId: string, micDeviceId?: string) => {
    const socket = sock();
    if (!socket) return;
    setState(s => ({ ...s, connecting: true }));

    // Leave current channel first
    if (currentChannelRef.current) {
      socket.emit('leaveVoiceChannel', () => {});
      closeAllPeers();
      stopSpeakingDetection();
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }

    // Acquire microphone
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: micDeviceId ? { deviceId: { exact: micDeviceId }, echoCancellation: true, noiseSuppression: true, autoGainControl: true } : { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
    } catch {
      setState(s => ({ ...s, connecting: false }));
      throw new Error('mic-denied');
    }

    localStreamRef.current = stream;
    startSpeakingDetection(stream);

    socket.emit('joinVoiceChannel', { channelId }, async (res: any) => {
      if (!res?.ok) {
        stream.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
        stopSpeakingDetection();
        setState(s => ({ ...s, connecting: false }));
        return;
      }

      currentChannelRef.current = channelId;
      setState(s => ({ ...s, currentChannel: channelId, connecting: false, serverMuted: false, muted: false }));

      // As the NEW JOINER: create offers to every EXISTING peer
      for (const peer of (res.existingPeers ?? [])) {
        const pc = buildPC(peer.socketId);
        try {
          const offer = await pc.createOffer({ offerToReceiveAudio: true });
          await pc.setLocalDescription(offer);
          socket.emit('voiceSignal', { targetSocketId: peer.socketId, signal: { type: 'offer', sdp: pc.localDescription } });
        } catch (e) { console.warn('[VC] offer create err', e); }
      }
    });
  }, [socketManager, buildPC, closeAllPeers, startSpeakingDetection, stopSpeakingDetection]); // eslint-disable-line react-hooks/exhaustive-deps

  const leaveChannel = useCallback(() => {
    sock()?.emit('leaveVoiceChannel', () => {});
    closeAllPeers();
    stopSpeakingDetection();
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    currentChannelRef.current = null;
    setState(s => ({ ...s, currentChannel: null, muted: false, deafened: false, serverMuted: false, connecting: false, speaking: false }));
  }, [closeAllPeers, stopSpeakingDetection]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMute = useCallback(() => {
    if (serverMutedRef.current) return; // can't unmute if server-muted
    const tracks = localStreamRef.current?.getAudioTracks() ?? [];
    const wasEnabled = tracks[0]?.enabled ?? true;
    tracks.forEach(t => { t.enabled = !wasEnabled; });
    setState(s => ({ ...s, muted: wasEnabled }));
  }, []);

  const toggleDeafen = useCallback(() => {
    const nowDeaf = !deafenedRef.current;
    deafenedRef.current = nowDeaf;
    // Mute/unmute all remote audio elements
    audioContainerRef.current?.querySelectorAll('audio').forEach(el => {
      (el as HTMLAudioElement).muted = nowDeaf;
    });
    // Also mute own mic when deafened (Discord behaviour)
    if (nowDeaf) {
      localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = false; });
      setState(s => ({ ...s, deafened: true, muted: true }));
    } else {
      if (!serverMutedRef.current) {
        localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = true; });
        setState(s => ({ ...s, deafened: false, muted: false }));
      } else {
        setState(s => ({ ...s, deafened: false }));
      }
    }
  }, []);

  const setMicDevice = useCallback(async (deviceId: string) => {
    if (!localStreamRef.current) return;
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({ audio: deviceId ? { deviceId: { exact: deviceId } } : true, video: false });
      const [newTrack] = newStream.getAudioTracks();
      peersRef.current.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
        if (sender && newTrack) sender.replaceTrack(newTrack).catch(() => {});
      });
      localStreamRef.current.getAudioTracks().forEach(t => t.stop());
      localStreamRef.current = newStream;
      // Restart speaking detection
      stopSpeakingDetection();
      startSpeakingDetection(newStream);
    } catch {}
  }, [startSpeakingDetection, stopSpeakingDetection]);

  const applySpeaker = useCallback((deviceId: string) => {
    speakerRef.current = deviceId;
    audioContainerRef.current?.querySelectorAll('audio').forEach(el => {
      if ('setSinkId' in el) (el as any).setSinkId(deviceId).catch(() => {});
    });
  }, []);

  return { ...state, joinChannel, leaveChannel, toggleMute, toggleDeafen, setMicDevice, applySpeaker };
}
