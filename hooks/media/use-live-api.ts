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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GenAILiveClient } from '../../lib/genai-live-client';
import { LiveConnectConfig, Modality, LiveServerToolCall } from '@google/genai';
import { AudioStreamer } from '../../lib/audio-streamer';
import { audioContext } from '../../lib/utils';
import VolMeterWorket from '../../lib/worklets/vol-meter';
import { useLogStore, useSettings, useUserSettings, useWhatsAppIntegrationStore, useAuthStore } from '@/lib/state';

export type UseLiveApiResults = {
  client: GenAILiveClient;
  setConfig: (config: LiveConnectConfig) => void;
  config: LiveConnectConfig;

  connect: () => Promise<void>;
  disconnect: () => void;
  connected: boolean;
  status: 'connected' | 'disconnected' | 'connecting';

  volume: number;
  isSpeakerMuted: boolean;
  toggleSpeakerMute: () => void;
};

async function handleSendEmail(
  args: any,
  auth: { isGoogleConnected: boolean; accessToken: string | null },
) {
  if (!auth.isGoogleConnected || !auth.accessToken) {
    return 'User is not connected to Google. Please ask them to sign in with their Google account.';
  }

  const { recipient, subject, body } = args;
  if (!recipient || !subject || !body) {
    return 'Missing required parameters for sending an email. I need a recipient, a subject, and a body.';
  }

  // Create RFC 2822 message
  const email = [
    `To: ${recipient}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${subject}`,
    '',
    body,
  ].join('\r\n');

  // Using btoa(unescape(encodeURIComponent(str))) for proper UTF-8 handling
  const base64EncodedEmail = btoa(unescape(encodeURIComponent(email)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  try {
    const response = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          raw: base64EncodedEmail,
        }),
      },
    );
    const data = await response.json();
    if (!response.ok) {
      console.error('Gmail API error:', data);
      return `Failed to send email: ${data.error.message}`;
    }
    return 'Email sent successfully.';
  } catch (error) {
    console.error('Error sending email:', error);
    return `An error occurred while sending the email: ${
      (error as Error).message
    }`;
  }
}

async function handleReadEmails(
  args: any,
  auth: { isGoogleConnected: boolean; accessToken: string | null },
) {
  if (!auth.isGoogleConnected || !auth.accessToken) {
    return 'User is not connected to Google. Please ask them to sign in with their Google account.';
  }

  const { count = 5, from, subject, unreadOnly = true } = args;
  let query = '';
  if (from) query += `from:${from} `;
  if (subject) query += `subject:(${subject}) `;
  if (unreadOnly) query += `is:unread `;

  try {
    const listResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${count}&q=${encodeURIComponent(
        query.trim(),
      )}`,
      {
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      },
    );
    const listData = await listResponse.json();
    if (!listResponse.ok) throw new Error(listData.error.message);

    if (!listData.messages || listData.messages.length === 0) {
      return 'No matching emails found.';
    }

    const emailPromises = listData.messages.map((message: any) =>
      fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`,
        {
          headers: { Authorization: `Bearer ${auth.accessToken}` },
        },
      ).then(res => res.json()),
    );

    const emails = await Promise.all(emailPromises);

    const summaries = emails.map(email => {
      const fromHeader =
        email.payload.headers.find((h: any) => h.name === 'From')?.value ||
        'Unknown Sender';
      const subjectHeader =
        email.payload.headers.find((h: any) => h.name === 'Subject')?.value ||
        'No Subject';
      return `From: ${fromHeader}, Subject: ${subjectHeader}`;
    });

    return `Here are the latest emails:\n- ${summaries.join('\n- ')}`;
  } catch (error) {
    console.error('Error reading emails:', error);
    return `An error occurred while reading emails: ${(error as Error).message}`;
  }
}

async function handleSaveMemory(args: any) {
  const { text_to_remember } = args;
  if (!text_to_remember) {
    return 'Missing required text to remember.';
  }
  await useUserSettings.getState().addMemory(text_to_remember);
  return 'Information noted.';
}

async function handleSendWhatsAppMessage(args: any) {
  return useWhatsAppIntegrationStore
    .getState()
    .sendMessage(args.recipient_phone_number, args.message_body);
}

async function handleReadWhatsAppChatHistory(args: any) {
  return useWhatsAppIntegrationStore
    .getState()
    .readChatHistory(args.contact_name_or_phone, args.message_count);
}

async function handleSearchWhatsAppContact(args: any) {
  return useWhatsAppIntegrationStore
    .getState()
    .searchContact(args.contact_name);
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
}

async function handleListDriveFiles(
  args: { count?: number; query?: string },
  auth: { isGoogleConnected: boolean; accessToken: string | null },
) {
  if (!auth.isGoogleConnected || !auth.accessToken) {
    return 'User is not connected to Google. Please ask them to sign in with their Google account.';
  }

  const { count = 10, query } = args;
  const baseUrl = 'https://www.googleapis.com/drive/v3/files';
  const params = new URLSearchParams({
    pageSize: count.toString(),
    fields: 'files(id, name, mimeType, webViewLink)',
  });
  if (query) {
    params.append('q', query);
  }

  try {
    const response = await fetch(`${baseUrl}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    });
    const data = await response.json();
    if (!response.ok) {
        const errorMessage = data?.error?.message || `Google Drive API error: ${response.statusText}`;
        throw new Error(errorMessage);
    }


    if (!data.files || data.files.length === 0) {
      return 'No files found in Google Drive.';
    }

    const fileSummaries = data.files
      .map((file: DriveFile) => `Name: ${file.name}, Type: ${file.mimeType}`)
      .join('\n- ');
    return `Here are the files I found:\n- ${fileSummaries}`;
  } catch (error) {
    console.error('Error listing Drive files:', error);
    return `An error occurred while listing Drive files: ${(error as Error).message}`;
  }
}

async function handleReadSheetData(
  args: any,
  auth: { isGoogleConnected: boolean; accessToken: string | null },
) {
  if (!auth.isGoogleConnected || !auth.accessToken) {
    return 'User is not connected to Google. Please ask them to sign in with their Google account.';
  }

  const { spreadsheetId, range } = args;
  if (!spreadsheetId || !range) {
    return 'Missing spreadsheet ID or range to read data.';
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error.message);

    if (!data.values || data.values.length === 0) {
      return `No data found in range ${range}.`;
    }

    const formattedData = data.values
      .map((row: any[]) => row.join(', '))
      .join('\n');
    return `Here is the data from the sheet:\n${formattedData}`;
  } catch (error) {
    console.error('Error reading Sheet data:', error);
    return `An error occurred while reading the sheet: ${(error as Error).message}`;
  }
}

async function handleListCalendarEvents(
  args: any,
  auth: { isGoogleConnected: boolean; accessToken: string | null },
) {
  if (!auth.isGoogleConnected || !auth.accessToken) {
    return 'User is not connected to Google. Please ask them to sign in with their Google account.';
  }

  const { count = 10 } = args;
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events`;
  const params = new URLSearchParams({
    maxResults: count.toString(),
    orderBy: 'startTime',
    singleEvents: 'true',
    timeMin: new Date().toISOString(),
  });

  try {
    const response = await fetch(`${url}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error.message);

    if (!data.items || data.items.length === 0) {
      return 'No upcoming events found on your calendar.';
    }

    const eventSummaries = data.items
      .map((event: any) => {
        const start = event.start.dateTime || event.start.date;
        return `${event.summary} at ${new Date(start).toLocaleString()}`;
      })
      .join('\n- ');
    return `Here are your upcoming events:\n- ${eventSummaries}`;
  } catch (error) {
    console.error('Error listing calendar events:', error);
    return `An error occurred while listing calendar events: ${(error as Error).message}`;
  }
}

async function handleCreateCalendarEvent(
  args: any,
  auth: { isGoogleConnected: boolean; accessToken: string | null },
) {
  if (!auth.isGoogleConnected || !auth.accessToken) {
    return 'User is not connected to Google. Please ask them to sign in with their Google account.';
  }

  const { summary, location, description, startDateTime, endDateTime } = args;
  if (!summary || !startDateTime || !endDateTime) {
    return 'Missing required information to create an event. I need at least a summary, start time, and end time.';
  }

  const event = {
    summary,
    location,
    description,
    start: {
      dateTime: startDateTime,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    end: {
      dateTime: endDateTime,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  };

  try {
    const response = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      },
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.error.message);
    return `Event "${summary}" created successfully.`;
  } catch (error) {
    console.error('Error creating calendar event:', error);
    return `An error occurred while creating the event: ${(error as Error).message}`;
  }
}

export function useLiveApi({
  apiKey,
}: {
  apiKey: string;
}): UseLiveApiResults {
  const { model } = useSettings();
  const client = useMemo(
    () => new GenAILiveClient(apiKey, model),
    [apiKey, model],
  );

  const audioStreamerRef = useRef<AudioStreamer | null>(null);

  const [volume, setVolume] = useState(0);
  const [status, setStatus] =
    useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
  const connected = status === 'connected';
  const [config, setConfig] = useState<LiveConnectConfig>({});
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);

  const toggleSpeakerMute = useCallback(() => {
    if (audioStreamerRef.current) {
      const newMutedState = !isSpeakerMuted;
      audioStreamerRef.current.setMuted(newMutedState);
      setIsSpeakerMuted(newMutedState);
    }
  }, [isSpeakerMuted]);

  // register audio for streaming server -> speakers
  useEffect(() => {
    if (!audioStreamerRef.current) {
      audioContext({ id: 'audio-out' }).then((audioCtx: AudioContext) => {
        audioStreamerRef.current = new AudioStreamer(audioCtx);
        audioStreamerRef.current
          .addWorklet<any>('vumeter-out', VolMeterWorket, (ev: any) => {
            setVolume(ev.data.volume);
          })
          .then(() => {
            // Successfully added worklet
          })
          .catch(err => {
            console.error('Error adding worklet:', err);
          });
      });
    }
  }, [audioStreamerRef]);

  useEffect(() => {
    const onStatus = (s: 'connected' | 'disconnected' | 'connecting') => {
      setStatus(s);
    };

    const stopAudioStreamer = () => {
      if (audioStreamerRef.current) {
        audioStreamerRef.current.stop();
      }
    };

    const onAudio = (data: ArrayBuffer) => {
      if (audioStreamerRef.current) {
        audioStreamerRef.current.addPCM16(new Uint8Array(data));
      }
    };

    // Bind event listeners
    client.on('status', onStatus);
    client.on('interrupted', stopAudioStreamer);
    client.on('audio', onAudio);

    const onToolCall = async (toolCall: LiveServerToolCall) => {
      const { session } = useAuthStore.getState();
      const isGoogleConnected = !!session?.provider_token;
      const accessToken = session?.provider_token ?? null;

      const functionResponses: any[] = [];

      for (const fc of toolCall.functionCalls) {
        // Log the function call trigger
        const triggerMessage = `Triggering function call: **${
          fc.name
        }**\n\`\`\`json\n${JSON.stringify(fc.args, null, 2)}\n\`\`\``;
        useLogStore.getState().addTurn({
          role: 'system',
          text: triggerMessage,
          isFinal: true,
        });

        let resultPromise;

        switch (fc.name) {
          case 'send_email':
            resultPromise = handleSendEmail(fc.args, {
              isGoogleConnected,
              accessToken,
            });
            break;
          case 'read_emails':
            resultPromise = handleReadEmails(fc.args, {
              isGoogleConnected,
              accessToken,
            });
            break;
          case 'save_memory':
            resultPromise = handleSaveMemory(fc.args);
            break;
          case 'send_whatsapp_message':
            resultPromise = handleSendWhatsAppMessage(fc.args);
            break;
          case 'read_whatsapp_chat_history':
            resultPromise = handleReadWhatsAppChatHistory(fc.args);
            break;
          case 'search_whatsapp_contact':
            resultPromise = handleSearchWhatsAppContact(fc.args);
            break;
          case 'list_drive_files':
            resultPromise = handleListDriveFiles(fc.args, {
              isGoogleConnected,
              accessToken,
            });
            break;
          case 'read_sheet_data':
            resultPromise = handleReadSheetData(fc.args, {
              isGoogleConnected,
              accessToken,
            });
            break;
          case 'list_calendar_events':
            resultPromise = handleListCalendarEvents(fc.args, {
              isGoogleConnected,
              accessToken,
            });
            break;
          case 'create_calendar_event':
            resultPromise = handleCreateCalendarEvent(fc.args, {
              isGoogleConnected,
              accessToken,
            });
            break;
          default:
            resultPromise = Promise.resolve('ok'); // Default for other tools
        }

        const result = await resultPromise;

        functionResponses.push({
          id: fc.id,
          name: fc.name,
          response: { result: result },
        });
      }

      // Log the function call response
      if (functionResponses.length > 0) {
        const responseMessage = `Function call response:\n\`\`\`json\n${JSON.stringify(
          functionResponses.map(r => r.response.result),
          null,
          2,
        )}\n\`\`\``;
        useLogStore.getState().addTurn({
          role: 'system',
          text: responseMessage,
          isFinal: true,
        });
      }

      client.sendToolResponse({ functionResponses: functionResponses });
    };

    client.on('toolcall', onToolCall);

    return () => {
      // Clean up event listeners
      client.off('status', onStatus);
      client.off('interrupted', stopAudioStreamer);
      client.off('audio', onAudio);
      client.off('toolcall', onToolCall);
    };
  }, [client]);

  const connect = useCallback(async () => {
    if (!config) {
      throw new Error('config has not been set');
    }
    // Do not reconnect if already connected or connecting
    if (client.status === 'connected' || client.status === 'connecting') {
      return;
    }
    await client.connect(config);
  }, [client, config]);

  const disconnect = useCallback(async () => {
    client.disconnect();
  }, [client]);

  return {
    client,
    config,
    setConfig,
    connect,
    connected,
    status,
    disconnect,
    volume,
    isSpeakerMuted,
    toggleSpeakerMute,
  };
}