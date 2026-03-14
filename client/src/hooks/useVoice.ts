import { useEffect, useRef, useState, useCallback } from 'react';

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

interface Peer {
  socketId: string;
  email: string;
  username: string;
  pc: RTCPeerConnection;
  audioEl?: HTMLAudioElement;
}

interface VoiceState {
  currentChannel: string | null;
  muted: boolean;
  connecting: boolean;
  channelMembers: Record<string, Array<{ email: string; username: string }>>;
}

export function useVoice(socket: any, userEmail: string) {
  const [state, setState] = useState<VoiceState>({
    currentChannel: null,
    muted: false,
    connecting: false,
    channelMembers: { General: [], Gaming: [], Music: [] },
  });

  const peersRef = useRef<Map<string, Peer>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const micDeviceRef = useRef<string>('');
  const speakerDeviceRef = useRef<string>('');

  // Apply speaker device to all audio elements
  const applySpeaker = useCallback((deviceId: string) => {
    speakerDeviceRef.current = deviceId;
    peersRef.current.forEach(peer => {
      if (peer.audioEl && 'setSinkId' in peer.audioEl) {
        (peer.audioEl as any).setSinkId(deviceId).catch(() => {});
      }
    });
  }, []);

  const createPeerConnection = useCallback((socketId: string, email: string, username: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Add local tracks
    localStreamRef.current?.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current!));

    // ICE candidate relay
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket?.emit('voiceSignal', {
          targetSocketId: socketId,
          signal: { type: 'ice', candidate: e.candidate },
        });
      }
    };

    // Remote audio
    pc.ontrack = (e) => {
      const stream = e.streams[0];
      const audio = new Audio();
      audio.srcObject = stream;
      audio.autoplay = true;
      if (speakerDeviceRef.current && 'setSinkId' in audio) {
        (audio as any).setSinkId(speakerDeviceRef.current).catch(() => {});
      }
      const peer = peersRef.current.get(socketId);
      if (peer) peer.audioEl = audio;
      audio.play().catch(() => {});
    };

    const peer: Peer = { socketId, email, username, pc };
    peersRef.current.set(socketId, peer);
    return pc;
  }, [socket]);

  const removePeer = useCallback((socketId: string) => {
    const peer = peersRef.current.get(socketId);
    if (peer) {
      peer.pc.close();
      if (peer.audioEl) {
        peer.audioEl.srcObject = null;
        peer.audioEl.remove();
      }
      peersRef.current.delete(socketId);
    }
  }, []);

  const stopLocalStream = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
  }, []);

  const joinChannel = useCallback(async (channelId: string, micDeviceId?: string) => {
    if (!socket) return;
    setState(s => ({ ...s, connecting: true }));

    try {
      // Get mic access
      const constraints: MediaStreamConstraints = {
        audio: micDeviceId ? { deviceId: { exact: micDeviceId } } : true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      if (micDeviceId) micDeviceRef.current = micDeviceId;

      socket.emit('joinVoiceChannel', { channelId }, async (res: any) => {
        if (!res?.ok) {
          stopLocalStream();
          setState(s => ({ ...s, connecting: false }));
          return;
        }

        setState(s => ({ ...s, currentChannel: channelId, connecting: false }));

        // The new joiner creates offers to all existing peers
        for (const existing of (res.existingPeers || [])) {
          const pc = createPeerConnection(existing.socketId, existing.email, existing.username);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('voiceSignal', {
            targetSocketId: existing.socketId,
            signal: { type: 'offer', sdp: pc.localDescription },
          });
        }
      });
    } catch {
      stopLocalStream();
      setState(s => ({ ...s, connecting: false }));
    }
  }, [socket, createPeerConnection, stopLocalStream]);

  const leaveChannel = useCallback(() => {
    if (!socket) return;
    socket.emit('leaveVoiceChannel', () => {});
    peersRef.current.forEach((_, id) => removePeer(id));
    peersRef.current.clear();
    stopLocalStream();
    setState(s => ({ ...s, currentChannel: null, muted: false, connecting: false }));
  }, [socket, removePeer, stopLocalStream]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setState(s => ({ ...s, muted: !s.muted }));
  }, []);

  const setMicDevice = useCallback(async (deviceId: string) => {
    micDeviceRef.current = deviceId;
    if (!localStreamRef.current) return;
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId } } });
      const [newTrack] = newStream.getAudioTracks();
      // Replace track in all peer connections
      peersRef.current.forEach(peer => {
        const sender = peer.pc.getSenders().find(s => s.track?.kind === 'audio');
        if (sender) sender.replaceTrack(newTrack).catch(() => {});
      });
      // Stop old track
      localStreamRef.current.getAudioTracks().forEach(t => t.stop());
      localStreamRef.current = newStream;
    } catch {}
  }, []);

  // Handle incoming socket events
  useEffect(() => {
    if (!socket) return;

    const onPeerJoined = ({ socketId, email, username }: any) => {
      // We are an existing member — we wait for the offer from the new joiner (no-op here)
      // We create a PC ready to accept the offer
      if (!peersRef.current.has(socketId)) {
        createPeerConnection(socketId, email, username);
      }
    };

    const onPeerLeft = ({ socketId }: any) => {
      removePeer(socketId);
    };

    const onSignal = async ({ fromSocketId, signal }: any) => {
      let peer = peersRef.current.get(fromSocketId);

      if (signal.type === 'offer') {
        if (!peer) {
          const pc = createPeerConnection(fromSocketId, '', '');
          peer = peersRef.current.get(fromSocketId)!;
        }
        await peer.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        const answer = await peer.pc.createAnswer();
        await peer.pc.setLocalDescription(answer);
        socket.emit('voiceSignal', {
          targetSocketId: fromSocketId,
          signal: { type: 'answer', sdp: peer.pc.localDescription },
        });
      } else if (signal.type === 'answer' && peer) {
        await peer.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      } else if (signal.type === 'ice' && peer) {
        try { await peer.pc.addIceCandidate(new RTCIceCandidate(signal.candidate)); } catch {}
      }
    };

    const onChannelsUpdated = (channels: Record<string, Array<{ email: string; username: string }>>) => {
      setState(s => ({ ...s, channelMembers: channels }));
    };

    socket.on('voicePeerJoined', onPeerJoined);
    socket.on('voicePeerLeft', onPeerLeft);
    socket.on('voiceSignal', onSignal);
    socket.on('voiceChannelsUpdated', onChannelsUpdated);

    // Load initial state
    socket.emit('getVoiceChannels', (res: any) => {
      if (res?.ok) setState(s => ({ ...s, channelMembers: res.channels }));
    });

    return () => {
      socket.off('voicePeerJoined', onPeerJoined);
      socket.off('voicePeerLeft', onPeerLeft);
      socket.off('voiceSignal', onSignal);
      socket.off('voiceChannelsUpdated', onChannelsUpdated);
    };
  }, [socket, createPeerConnection, removePeer]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      leaveChannel();
    };
  }, []);

  return {
    ...state,
    joinChannel,
    leaveChannel,
    toggleMute,
    setMicDevice,
    applySpeaker,
  };
}
