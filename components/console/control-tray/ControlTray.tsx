/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Fix: Import React to resolve 'Cannot find namespace React' error.
import React, { memo, useEffect, useRef, useState } from 'react';
import { AudioRecorder } from '../../../lib/audio-recorder';
import { useLiveAPIContext } from '../../../contexts/LiveAPIContext';
import { useLogStore, useUI } from '@/lib/state';
import cn from 'classnames';

const fileToBase64 = (
  file: File,
): Promise<{ data: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve({ data: base64String, mimeType: file.type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

function ControlTray() {
  const [audioRecorder] = useState(() => new AudioRecorder());
  const [muted, setMuted] = useState(false);
  const [text, setText] = useState('');
  const [attachedImage, setAttachedImage] = useState<{
    data: string;
    mimeType: string;
  } | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const connectionInitiated = useRef(false);

  const { isVoiceCallActive } = useUI();
  const { editingImage, setEditingImage } = useUI();
  const { client, connected, connect, status } = useLiveAPIContext();
  const { sendMessage } = useLogStore();
  const { showVoiceCall } = useUI();

  useEffect(() => {
    if (!connected) {
      setMuted(false);
    }
  }, [connected]);

  useEffect(() => {
    if (editingImage) {
      const imageUrl = `data:${editingImage.mimeType};base64,${editingImage.data}`;
      setImagePreview(imageUrl);
      setAttachedImage(editingImage);
    }
  }, [editingImage]);

  useEffect(() => {
    const onData = (base64: string) => {
      client.sendRealtimeInput([
        {
          mimeType: 'audio/pcm;rate=16000',
          data: base64,
        },
      ]);
    };
    // Don't record audio from here if the voice call is active
    if (connected && !isVoiceCallActive && !muted && audioRecorder) {
      audioRecorder.on('data', onData);
      audioRecorder.start().catch(err => {
        console.error('Failed to start audio recorder:', err);
        useUI
          .getState()
          .showSnackbar(
            'Could not start microphone. Please check permissions.',
          );
      });
    } else {
      audioRecorder.stop();
    }
    return () => {
      audioRecorder.stop();
      audioRecorder.off('data', onData);
    };
  }, [connected, client, muted, audioRecorder, isVoiceCallActive]);

  useEffect(() => {
    if (status === 'connected' && connectionInitiated.current) {
      showVoiceCall();
      connectionInitiated.current = false;
    } else if (status === 'disconnected' && connectionInitiated.current) {
      connectionInitiated.current = false;
    }
  }, [status, showVoiceCall]);

  const handleShowVoiceCall = async () => {
    try {
      // Request microphone permission.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Immediately stop the tracks to free up the microphone,
      // as AudioRecorder will request it again.
      stream.getTracks().forEach(track => track.stop());
      connectionInitiated.current = true;
      connect();
    } catch (err) {
      console.error('Error requesting microphone permission:', err);
      // Show a message to the user if permission is denied.
      useUI
        .getState()
        .showSnackbar('Microphone access is required for voice calls.');
    }
  };

  const handleMuteToggle = () => {
    if (connected) {
      setMuted(!muted);
    }
  };

  const removeImage = () => {
    if (imagePreview) {
      // Revoke object URL only if it's one, not for data URLs
      if (imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview);
      }
    }
    setImagePreview(null);
    setAttachedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Reset file input
    }
    // If we were editing, clear that state too
    if (editingImage) {
      setEditingImage(null);
    }
  };

  const handleSendText = async () => {
    if (!text.trim() && !attachedImage) return;

    const currentText = text;
    // If we are in editing mode, the image is already in the `editingImage`
    // global state. Otherwise, we send the newly attached image.
    const newImage = editingImage ? null : attachedImage;

    // Clear inputs immediately before sending
    setText('');
    removeImage(); // This will also clear editingImage state if active

    await sendMessage(currentText, newImage);
  };


  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendText();
    }
  };

  const handleImageButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      // If user attaches a new image, we are no longer in edit mode
      if (editingImage) {
        setEditingImage(null);
      }
      setImagePreview(URL.createObjectURL(file));
      const { data, mimeType } = await fileToBase64(file);
      setAttachedImage({ data, mimeType });
    }
  };

  return (
    <section className="control-tray">
      <div className="input-bar-wrapper">
        {imagePreview && (
          <div className="image-preview-container">
            <div className="image-preview">
              <img src={imagePreview} alt="Attachment preview" />
              <button
                className="remove-image-button icon-button"
                onClick={removeImage}
                aria-label="Remove image"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
          </div>
        )}
        <div className="input-row">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageChange}
            style={{ display: 'none' }}
            accept="image/*"
          />
          <button
            className="icon-button"
            aria-label="Attach image"
            onClick={handleImageButtonClick}
            disabled={isVoiceCallActive}
          >
            <span className="material-symbols-outlined">
              add_photo_alternate
            </span>
          </button>
          <input
            type="text"
            placeholder={
              editingImage
                ? 'Describe your edits...'
                : attachedImage
                  ? 'Add a message...'
                  : 'Ask anything, or create an image...'
            }
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isVoiceCallActive}
          />
          <div className="input-actions">
            {text || attachedImage ? (
              <button
                className="icon-button"
                onClick={handleSendText}
                aria-label="Send message"
                disabled={isVoiceCallActive}
              >
                <span className="material-symbols-outlined">send</span>
              </button>
            ) : (
              <button
                className="icon-button"
                onClick={handleMuteToggle}
                aria-label={muted ? 'Unmute' : 'Mute'}
                disabled={!connected || isVoiceCallActive}
              >
                <span className="material-symbols-outlined filled">
                  {muted ? 'mic_off' : 'mic'}
                </span>
              </button>
            )}
            {connected && !isVoiceCallActive ? (
              <button
                className="icon-button"
                onClick={showVoiceCall}
                aria-label="Return to voice call"
              >
                <span className="material-symbols-outlined filled">call</span>
              </button>
            ) : (
              <button
                className="icon-button"
                onClick={handleShowVoiceCall}
                aria-label={'Start voice conversation'}
                disabled={status !== 'disconnected'}
              >
                <span
                  className={cn('material-symbols-outlined filled', {
                    connecting: status === 'connecting',
                  })}
                >
                  graphic_eq
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default memo(ControlTray);