/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {
  GoogleGenAI,
  LiveCallbacks,
  LiveClientToolResponse,
  LiveConnectConfig,
  LiveServerContent,
  LiveServerMessage,
  LiveServerToolCall,
  LiveServerToolCallCancellation,
  Part,
  Session,
} from '@google/genai';
import EventEmitter from 'eventemitter3';
import { DEFAULT_LIVE_API_MODEL } from './constants';
import { difference } from 'lodash';
import { base64ToArrayBuffer } from './utils';

/**
 * Represents a single log entry in the system.
 * Used for tracking and displaying system events, messages, and errors.
 */
export interface StreamingLog {
  // Optional count for repeated log entries
  count?: number;
  // Optional additional data associated with the log
  data?: unknown;
  // Timestamp of when the log was created
  date: Date;
  // The log message content
  message: string | object;
  // The type/category of the log entry
  type: string;
}

/**
 * Event types that can be emitted by the MultimodalLiveClient.
 * Each event corresponds to a specific message from GenAI or client state change.
 */
export interface LiveClientEventTypes {
  // Emitted when audio data is received
  audio: (data: ArrayBuffer) => void;
  // Emitted when the connection closes
  close: (event: CloseEvent) => void;
  // Emitted when content is received from the server
  content: (data: LiveServerContent) => void;
  // Emitted when an error occurs
  error: (e: ErrorEvent) => void;
  // Emitted when the server interrupts the current generation
  interrupted: () => void;
  // Emitted for logging events
  log: (log: StreamingLog) => void;
  // Emitted when the connection opens
  open: () => void;
  // Emitted when the initial setup is complete
  setupcomplete: () => void;
  // Emitted when a tool call is received
  toolcall: (toolCall: LiveServerToolCall) => void;
  // Emitted when a tool call is cancelled
  toolcallcancellation: (
    toolcallCancellation: LiveServerToolCallCancellation
  ) => void;
  // Emitted when the current turn is complete
  turncomplete: () => void;
  inputTranscription: (text: string, isFinal: boolean) => void;
  outputTranscription: (text: string, isFinal: boolean) => void;
  status: (status: 'connected' | 'disconnected' | 'connecting') => void;
}

// FIX: Refactored to use composition over inheritance for EventEmitter.
export class GenAILiveClient {
  private emitter = new EventEmitter<LiveClientEventTypes>();
  public on = this.emitter.on.bind(this.emitter);
  public off = this.emitter.off.bind(this.emitter);
  public readonly model: string = DEFAULT_LIVE_API_MODEL;

  protected readonly client: GoogleGenAI;
  protected session?: Session;
  private sessionPromise: Promise<Session> | null = null;

  private _status: 'connected' | 'disconnected' | 'connecting' =
    'disconnected';
  public get status() {
    return this._status;
  }

  private setStatus(status: 'connected' | 'disconnected' | 'connecting') {
    if (this._status !== status) {
      this._status = status;
      this.emitter.emit('status', this._status);
    }
  }

  /**
   * Creates a new GenAILiveClient instance.
   * @param apiKey - API key for authentication with Google GenAI
   * @param model - Optional model name to override the default model
   */
  constructor(apiKey: string, model?: string) {
    if (model) this.model = model;

    this.client = new GoogleGenAI({
      apiKey: apiKey,
    });
  }

  public async connect(config: LiveConnectConfig): Promise<boolean> {
    if (this.status === 'connected' || this.status === 'connecting') {
      return false;
    }

    this.setStatus('connecting');
    const callbacks: LiveCallbacks = {
      onopen: this.onOpen.bind(this),
      onmessage: this.onMessage.bind(this),
      onerror: this.onError.bind(this),
      onclose: this.onClose.bind(this),
    };

    const promise = this.client.live.connect({
      model: this.model,
      config: {
        ...config,
      },
      callbacks,
    });
    this.sessionPromise = promise;

    try {
      this.session = await promise;
    } catch (e: any) {
      console.error('Error connecting to GenAI Live:', e);
      this.session = undefined;
      this.sessionPromise = null;
      const errorEvent = new ErrorEvent('error', {
        error: e,
        message: e?.message || 'Failed to connect.',
      });
      this.onError(errorEvent);
      return false;
    }

    return true;
  }

  public disconnect() {
    this.session?.close();
    this.session = undefined;
    this.sessionPromise = null;
    this.setStatus('disconnected');

    this.log('client.close', `Disconnected`);
    return true;
  }

  public send(parts: Part | Part[], turnComplete: boolean = true) {
    if (this.status !== 'connected' || !this.session) {
      this.emitter.emit(
        'error',
        new ErrorEvent('error', { message: 'Client is not connected' }),
      );
      return;
    }
    this.session.sendClientContent({ turns: parts, turnComplete });
    this.log(`client.send`, parts);
  }

  public sendRealtimeInput(chunks: Array<{ mimeType: string; data: string }>) {
    if (!this.sessionPromise) {
      this.emitter.emit(
        'error',
        new ErrorEvent('error', { message: 'Client is not connected' }),
      );
      return;
    }
    this.sessionPromise
      .then(session => {
        chunks.forEach(chunk => {
          session.sendRealtimeInput({ media: chunk });
        });

        let hasAudio = false;
        let hasVideo = false;
        for (let i = 0; i < chunks.length; i++) {
          const ch = chunks[i];
          if (ch.mimeType.includes('audio')) hasAudio = true;
          if (ch.mimeType.includes('image')) hasVideo = true;
          if (hasAudio && hasVideo) break;
        }

        let message = 'unknown';
        if (hasAudio && hasVideo) message = 'audio + video';
        else if (hasAudio) message = 'audio';
        else if (hasVideo) message = 'video';
        this.log(`client.realtimeInput`, message);
      })
      .catch(e => {
        this.emitter.emit(
          'error',
          new ErrorEvent('error', {
            error: e,
            message: 'Session promise rejected while sending data',
          }),
        );
      });
  }

  public sendToolResponse(toolResponse: LiveClientToolResponse) {
    if (this.status !== 'connected' || !this.session) {
      this.emitter.emit(
        'error',
        new ErrorEvent('error', { message: 'Client is not connected' }),
      );
      return;
    }
    if (
      toolResponse.functionResponses &&
      toolResponse.functionResponses.length
    ) {
      this.session.sendToolResponse({
        functionResponses: toolResponse.functionResponses!,
      });
    }

    this.log(`client.toolResponse`, { toolResponse });
  }

  protected onMessage(message: LiveServerMessage) {
    if (message.setupComplete) {
      this.emitter.emit('setupcomplete');
      return;
    }
    if (message.toolCall) {
      this.log('server.toolCall', message);
      this.emitter.emit('toolcall', message.toolCall);
      return;
    }
    if (message.toolCallCancellation) {
      this.log('receive.toolCallCancellation', message);
      this.emitter.emit('toolcallcancellation', message.toolCallCancellation);
      return;
    }

    if (message.serverContent) {
      const { serverContent } = message;
      if (serverContent.interrupted) {
        this.log('receive.serverContent', 'interrupted');
        this.emitter.emit('interrupted');
        return;
      }

      if (serverContent.inputTranscription) {
        this.emitter.emit(
          'inputTranscription',
          serverContent.inputTranscription.text,
          // FIX: Property 'isFinal' does not exist on type 'Transcription'.
          (serverContent.inputTranscription as any).isFinal ?? false,
        );
        this.log(
          'server.inputTranscription',
          serverContent.inputTranscription.text,
        );
      }

      if (serverContent.outputTranscription) {
        this.emitter.emit(
          'outputTranscription',
          serverContent.outputTranscription.text,
          // FIX: Property 'isFinal' does not exist on type 'Transcription'.
          (serverContent.outputTranscription as any).isFinal ?? false,
        );
        this.log(
          'server.outputTranscription',
          serverContent.outputTranscription.text,
        );
      }

      if (serverContent.modelTurn) {
        let parts: Part[] = serverContent.modelTurn.parts || [];

        const audioParts = parts.filter(p =>
          p.inlineData?.mimeType?.startsWith('audio/pcm'),
        );
        const base64s = audioParts.map(p => p.inlineData?.data);
        const otherParts = difference(parts, audioParts);

        base64s.forEach(b64 => {
          if (b64) {
            const data = base64ToArrayBuffer(b64);
            this.emitter.emit('audio', data);
            this.log(`server.audio`, `buffer (${data.byteLength})`);
          }
        });

        if (otherParts.length > 0) {
          const content: LiveServerContent = {
            modelTurn: { parts: otherParts },
          };
          this.emitter.emit('content', content);
          this.log(`server.content`, message);
        }
      }

      if (serverContent.turnComplete) {
        this.log('server.send', 'turnComplete');
        this.emitter.emit('turncomplete');
      }
    }
  }

  protected onError(e: ErrorEvent) {
    this.setStatus('disconnected');
    console.error('error:', e);

    const message = `Could not connect to GenAI Live: ${e.message}`;
    this.log(`server.${e.type}`, message);
    this.emitter.emit('error', e);
  }

  protected onOpen() {
    this.setStatus('connected');
    this.emitter.emit('open');
  }

  protected onClose(e: CloseEvent) {
    this.setStatus('disconnected');
    let reason = e.reason || '';
    if (reason.toLowerCase().includes('error')) {
      const prelude = 'ERROR]';
      const preludeIndex = reason.indexOf(prelude);
      if (preludeIndex > 0) {
        reason = reason.slice(preludeIndex + prelude.length + 1, Infinity);
      }
    }

    this.log(
      `server.${e.type}`,
      `disconnected ${reason ? `with reason: ${reason}` : ``}`,
    );
    this.emitter.emit('close', e);
  }

  /**
   * Internal method to emit a log event.
   * @param type - Log type
   * @param message - Log message
   */
  protected log(type: string, message: string | object) {
    this.emitter.emit('log', {
      type,
      message,
      date: new Date(),
    });
  }
}