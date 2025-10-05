/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// FIX: Import React to fix "Cannot find namespace 'React'" error.
import React, { useEffect, useRef, useState, memo } from 'react';
import { useLiveAPIContext } from '../../contexts/LiveAPIContext';
import { useUI, useUserSettings } from '../../lib/state';
import { AudioRecorder } from '../../lib/audio-recorder';
import cn from 'classnames';

const FRAME_RATE = 2; // Send 2 frames per second
const JPEG_QUALITY = 0.6; // Image quality for sent frames

// Helper to convert a Blob to a Base64 string, extracting only the data part.
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};


const VoiceCall = () => {
  const {
    client,
    connect,
    disconnect,
    connected,
    volume, // This is the agent's output volume
    isSpeakerMuted,
    toggleSpeakerMute,
  } = useLiveAPIContext();
  const { isVoiceCallActive, hideVoiceCall } = useUI();
  const { personaName } = useUserSettings();

  const [audioRecorder] = useState(() => new AudioRecorder());
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [userVolume, setUserVolume] = useState(0); // State for user's input volume
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameIntervalRef = useRef<number | null>(null);


  useEffect(() => {
    // Automatically connect when the voice call UI becomes active
    if (isVoiceCallActive) {
      connect();
    }
  }, [isVoiceCallActive, connect]);

  // Handle user's input volume for visualization
  useEffect(() => {
    const onVolume = (vol: number) => {
      setUserVolume(vol);
    };
    if (connected && !isMuted) {
      audioRecorder.on('volume', onVolume);
    }
    return () => {
      audioRecorder.off('volume', onVolume);
    };
  }, [connected, isMuted, audioRecorder]);

  // Handle audio recording and streaming to the API
  useEffect(() => {
    const onData = (base64: string) => {
      client.sendRealtimeInput([
        {
          mimeType: 'audio/pcm;rate=16000',
          data: base64,
        },
      ]);
    };
    if (isVoiceCallActive && connected && !isMuted && audioRecorder) {
      audioRecorder.on('data', onData);
      audioRecorder.start();
    } else {
      audioRecorder.stop();
    }
    return () => {
      audioRecorder.stop();
      audioRecorder.off('data', onData);
    };
  }, [isVoiceCallActive, connected, client, isMuted, audioRecorder]);

  // Handle camera stream
  useEffect(() => {
    if (!isCameraOn) {
      // If camera is off, ensure any existing stream is stopped.
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      return;
    }

    // If camera is on, request stream.
    let stream: MediaStream | null = null;
    let cancelled = false;

    const enableCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
        if (cancelled) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        } else {
          // Component unmounted after await, but before assignment
          stream.getTracks().forEach(track => track.stop());
        }
      } catch (err) {
        console.error('Error accessing camera:', err);
        if (!cancelled) {
          setIsCameraOn(false); // Turn off toggle if permission is denied
        }
      }
    };

    enableCamera();

    return () => {
      cancelled = true;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isCameraOn, facingMode]);

  // Effect to stream video frames to the API
  useEffect(() => {
    if (isCameraOn && connected && videoRef.current && canvasRef.current) {
      const videoEl = videoRef.current;
      const canvasEl = canvasRef.current;
      const ctx = canvasEl.getContext('2d');

      if (!ctx) return;

      frameIntervalRef.current = window.setInterval(() => {
        canvasEl.width = videoEl.videoWidth;
        canvasEl.height = videoEl.videoHeight;
        ctx.drawImage(videoEl, 0, 0, videoEl.videoWidth, videoEl.videoHeight);
        canvasEl.toBlob(
          async (blob) => {
            if (blob) {
              const base64Data = await blobToBase64(blob);
              client.sendRealtimeInput([
                {
                  mimeType: 'image/jpeg',
                  data: base64Data,
                },
              ]);
            }
          },
          'image/jpeg',
          JPEG_QUALITY
        );
      }, 1000 / FRAME_RATE);
    }

    return () => {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }
    };
  }, [isCameraOn, connected, client]);


  const handleEndCall = () => {
    disconnect();
    hideVoiceCall();
  };

  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
  };

  const handleCameraToggle = () => {
    setIsCameraOn(!isCameraOn);
  };

  const handleCameraSwitch = () => {
    setFacingMode(prev => (prev === 'user' ? 'environment' : 'user'));
  };

  // Define thresholds for speaking state
  const isUserSpeaking = userVolume > 0.01;
  const isAgentSpeaking = volume > 0.01;
  const isIdle = !isUserSpeaking && !isAgentSpeaking;

  return (
    <div className={cn('voice-call-overlay', { 'active': isVoiceCallActive })}>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <div className="satellite">
        <span className="material-symbols-outlined">satellite_alt</span>
      </div>
      <header className="voice-call-header">
        <span className="voice-call-persona-name">{personaName}</span>
        <div className="voice-call-header-actions">
          {isCameraOn && (
            <button
              className="icon-button"
              aria-label="Switch camera"
              onClick={handleCameraSwitch}
            >
              <span className="material-symbols-outlined">cameraswitch</span>
            </button>
          )}
          <button
            className="icon-button"
            aria-label={isSpeakerMuted ? 'Unmute speaker' : 'Mute speaker'}
            onClick={toggleSpeakerMute}
          >
            <span className="material-symbols-outlined">
              {isSpeakerMuted ? 'volume_off' : 'volume_up'}
            </span>
          </button>
          <button className="icon-button" aria-label="More options">
            <span className="material-symbols-outlined">tune</span>
          </button>
        </div>
      </header>

      <main className="voice-call-main">
        <div className="voice-call-orb-container">
          <div className="voice-call-orb">
            {isCameraOn && (
              <video
                ref={videoRef}
                className="voice-call-video-preview"
                autoPlay
                playsInline
                muted
              />
            )}
            <div
              className="voice-call-orb-effect standby-effect"
              style={{ opacity: isIdle ? 0.5 : 0 }}
            />
            <div
              className="voice-call-orb-effect user-smoke-effect"
              style={{ opacity: Math.min(1, userVolume * 20) }}
            />
            <div
              className="voice-call-orb-effect agent-smoke-effect"
              style={{ opacity: Math.min(1, volume * 15) }}
            />
          </div>
        </div>
      </main>

      <footer className="voice-call-footer">
        <button
          className={cn('voice-call-button', { 'toggled-off': !isCameraOn })}
          onClick={handleCameraToggle}
          aria-label={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
        >
          <span className="material-symbols-outlined">
            {isCameraOn ? 'videocam' : 'videocam_off'}
          </span>
        </button>
        <button
          className={cn('voice-call-button', { 'toggled-off': isMuted })}
          onClick={handleMuteToggle}
          aria-label={isMuted ? 'Unmute' : 'Mute'}
        >
          <span className="material-symbols-outlined">
            {isMuted ? 'mic_off' : 'mic'}
          </span>
        </button>
        <button
          className="voice-call-button"
          aria-label="Open chat"
          onClick={hideVoiceCall}
        >
          <span className="material-symbols-outlined">chat</span>
        </button>
        <button
          className="voice-call-button end-call"
          onClick={handleEndCall}
          aria-label="End call"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
      </footer>
    </div>
  );
};

export default memo(VoiceCall);