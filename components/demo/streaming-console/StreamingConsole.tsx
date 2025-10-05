/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useEffect, useRef, useState } from 'react';
import WelcomeScreen from '../welcome-screen/WelcomeScreen';
// FIX: Import LiveServerContent to correctly type the content handler.
import { LiveConnectConfig, Modality, LiveServerContent, FunctionDeclaration } from '@google/genai';

import { useLiveAPIContext } from '../../../contexts/LiveAPIContext';
import {
  useSettings,
  useLogStore,
  useTools,
  ConversationTurn,
  useUserSettings,
  businessAssistantTools,
  FunctionCall,
  useAuthStore,
  useUI,
} from '@/lib/state';
import { coreTools } from '@/lib/tools/core';

const formatTimestamp = (date: Date) => {
  const pad = (num: number, size = 2) => num.toString().padStart(size, '0');
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  const milliseconds = pad(date.getMilliseconds(), 3);
  return `${hours}:${minutes}:${seconds}.${milliseconds}`;
};

const renderContent = (text: string) => {
  // Split by ```json...``` code blocks
  const parts = text.split(/(`{3}json\n[\s\S]*?\n`{3})/g);

  return parts.map((part, index) => {
    if (part.startsWith('```json')) {
      const jsonContent = part.replace(/^`{3}json\n|`{3}$/g, '');
      return (
        <pre key={index}>
          <code>{jsonContent}</code>
        </pre>
      );
    }

    // Split by **bold** text
    const boldParts = part.split(/(\*\*.*?\*\*)/g);
    return boldParts.map((boldPart, boldIndex) => {
      if (boldPart.startsWith('**') && boldPart.endsWith('**')) {
        return <strong key={boldIndex}>{boldPart.slice(2, -2)}</strong>;
      }
      return boldPart;
    });
  });
};


export default function StreamingConsole() {
  const { client, setConfig } = useLiveAPIContext();
  const { voice, getSystemPrompt } = useUserSettings();
  const { session } = useAuthStore();
  const isGoogleConnected = !!session?.provider_token;
  const { tools } = useTools();
  const turns = useLogStore(state => state.turns);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { setEditingImage } = useUI();

  const handleEditImage = (base64Url: string) => {
    const [header, data] = base64Url.split(',');
    if (!header || !data) return;
    const mimeTypeMatch = header.match(/data:(.*);base64/);
    if (!mimeTypeMatch || !mimeTypeMatch[1]) return;
    const mimeType = mimeTypeMatch[1];
    setEditingImage({ data, mimeType });
  };


  // Set the configuration for the Live API
  useEffect(() => {
    const gmailTools: FunctionCall[] = isGoogleConnected
      ? businessAssistantTools
      : [];

    const allTools = [
      ...tools.filter(t => t.isEnabled),
      ...gmailTools,
      ...coreTools,
    ];

    const enabledTools = allTools.filter(
      (tool, index, self) =>
        index === self.findIndex(t => t.name === tool.name),
    );

    const functionDeclarations: FunctionDeclaration[] = enabledTools.map(
      ({ name, description, parameters }) => ({
        name,
        description: description || '',
        parameters,
      }),
    );
    
    // Using `any` for config to accommodate `speechConfig`, which is not in the
    // current TS definitions but is used in the working reference example.
    const config: any = {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: voice,
          },
        },
      },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      systemInstruction: getSystemPrompt(),
      tools: [
        { functionDeclarations: functionDeclarations },
        { googleSearch: {} }
      ],
    };

    setConfig(config);
  }, [setConfig, getSystemPrompt, voice, tools, isGoogleConnected]);

  useEffect(() => {
    const { addTurn, updateLastTurn } = useLogStore.getState();

    const handleInputTranscription = (text: string, isFinal: boolean) => {
      const turns = useLogStore.getState().turns;
      const last = turns[turns.length - 1];
      if (last && last.role === 'user' && !last.isFinal) {
        updateLastTurn({
          text: last.text + text,
          isFinal,
        });
      } else {
        addTurn({ role: 'user', text, isFinal });
      }
    };

    const handleOutputTranscription = (text: string, isFinal: boolean) => {
      const turns = useLogStore.getState().turns;
      const last = turns[turns.length - 1];
      if (last && last.role === 'agent' && !last.isFinal) {
        updateLastTurn({
          text: last.text + text,
          isFinal,
        });
      } else {
        addTurn({ role: 'agent', text, isFinal });
      }
    };

    // FIX: The 'content' event provides a single LiveServerContent object.
    // The function signature is updated to accept one argument, and groundingMetadata is extracted from it.
    const handleContent = (serverContent: LiveServerContent) => {
      const text =
        serverContent.modelTurn?.parts
          ?.map((p: any) => p.text)
          .filter(Boolean)
          .join(' ') ?? '';
      const groundingChunks = serverContent.groundingMetadata?.groundingChunks;

      if (!text && !groundingChunks) return;

      const turns = useLogStore.getState().turns;
      // FIX: Property 'at' does not exist on type 'ConversationTurn[]'.
      const last = turns[turns.length - 1];

      if (last?.role === 'agent' && !last.isFinal) {
        const updatedTurn: Partial<ConversationTurn> = {
          text: last.text + text,
        };
        if (groundingChunks) {
          updatedTurn.groundingChunks = [
            ...(last.groundingChunks || []),
            ...groundingChunks,
          ];
        }
        updateLastTurn(updatedTurn);
      } else {
        addTurn({ role: 'agent', text, isFinal: false, groundingChunks });
      }
    };

    const handleTurnComplete = () => {
      // FIX: Property 'at' does not exist on type 'ConversationTurn[]'.
      const turns = useLogStore.getState().turns;
      const last = turns[turns.length - 1];
      if (last && !last.isFinal) {
        updateLastTurn({ isFinal: true });
      }
    };

    client.on('inputTranscription', handleInputTranscription);
    client.on('outputTranscription', handleOutputTranscription);
    client.on('content', handleContent);
    client.on('turncomplete', handleTurnComplete);

    return () => {
      client.off('inputTranscription', handleInputTranscription);
      client.off('outputTranscription', handleOutputTranscription);
      client.off('content', handleContent);
      client.off('turncomplete', handleTurnComplete);
    };
  }, [client]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns]);

  return (
    <div className="transcription-container">
      {turns.length === 0 ? (
        <WelcomeScreen />
      ) : (
        <div className="transcription-view" ref={scrollRef}>
          {turns.map((t, i) => (
            <div
              key={i}
              className={`transcription-entry ${t.role} ${!t.isFinal ? 'interim' : ''
                }`}
            >
              <div className="transcription-header">
                <div className="transcription-source">
                  {t.role === 'user'
                    ? 'You'
                    : t.role === 'agent'
                      ? 'Agent'
                      : 'System'}
                </div>
                <div className="transcription-timestamp">
                  {formatTimestamp(t.timestamp)}
                </div>
              </div>
              <div className="transcription-text-content">
                {t.image && (
                  <div className="image-container">
                    <img
                      src={t.image}
                      alt="User attachment"
                      className="attached-image"
                    />
                    {t.role === 'agent' && (
                      <button
                        className="edit-image-button icon-button"
                        onClick={() => handleEditImage(t.image!)}
                        aria-label="Edit this image"
                      >
                        <span className="material-symbols-outlined">edit</span>
                      </button>
                    )}
                  </div>
                )}
                {renderContent(t.text)}
              </div>
              {t.groundingChunks && t.groundingChunks.length > 0 && (
                <div className="grounding-chunks">
                  <strong>Sources:</strong>
                  <ul>
                    {t.groundingChunks
                      // FIX: Ensure web and web.uri exist to prevent rendering broken links.
                      .filter(chunk => chunk.web && chunk.web.uri)
                      .map((chunk, index) => (
                        <li key={index}>
                          <a
                            href={chunk.web!.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {chunk.web!.title || chunk.web!.uri}
                          </a>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}