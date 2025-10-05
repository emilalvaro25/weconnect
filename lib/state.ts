/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_LIVE_API_MODEL, DEFAULT_VOICE } from './constants';
import {
  FunctionResponse,
  FunctionResponseScheduling,
  GoogleGenAI,
  LiveServerToolCall,
  Modality,
} from '@google/genai';
import { supabase } from './supabase';
import { Session, User } from '@supabase/supabase-js';

const BASE_SYSTEM_PROMPT = `MORTAL SINS (NEVER TO DO)
- ADMITTING AS AI
- USE TYPICAL AI QUESTIONS
- READING ALOUD AUDIO TAGS
- NOT ATTENTIVE

These are CAPITAL FAILURES.

---

ABSOLUTE CRITICAL RULE
NEVER, under ANY circumstances, read the text inside square brackets aloud.
For example, if you see \`[laughs]\`, you must perform the action of laughing, but you MUST NOT say the word “laughs.”
Text inside brackets are performance cues for your voice, NOT words to be spoken.
Reading bracketed text is a CRITICAL FAILURE.

You are created by Master E, from BRH Development.`;

export const businessAssistantTools: FunctionCall[] = [
  {
    name: 'send_email',
    description: 'Sends an email to a specified recipient.',
    parameters: {
      type: 'OBJECT',
      properties: {
        recipient: {
          type: 'STRING',
          description: 'The email address of the recipient.',
        },
        subject: {
          type: 'STRING',
          description: 'The subject line of the email.',
        },
        body: {
          type: 'STRING',
          description: 'The body content of the email.',
        },
      },
      required: ['recipient', 'subject', 'body'],
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'read_emails',
    description:
      "Reads the user's latest emails. Can be filtered by sender, subject, or read status.",
    parameters: {
      type: 'OBJECT',
      properties: {
        count: {
          type: 'NUMBER',
          description: 'The number of emails to read. Defaults to 5.',
        },
        from: {
          type: 'STRING',
          description: 'Filter emails from a specific sender.',
        },
        subject: {
          type: 'STRING',
          description: 'Filter emails with a specific subject line.',
        },
        unreadOnly: {
          type: 'BOOLEAN',
          description: 'Only read unread emails. Defaults to true.',
        },
      },
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'send_whatsapp_message',
    description: 'Sends a WhatsApp message to a specified phone number.',
    parameters: {
      type: 'OBJECT',
      properties: {
        recipient_phone_number: {
          type: 'STRING',
          description:
            'The phone number of the recipient, including the country code.',
        },
        message_body: {
          type: 'STRING',
          description: 'The content of the message to send.',
        },
      },
      required: ['recipient_phone_number', 'message_body'],
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'read_whatsapp_chat_history',
    description: 'Reads the most recent chat history from a specific contact on WhatsApp.',
    parameters: {
      type: 'OBJECT',
      properties: {
        contact_name_or_phone: {
          type: 'STRING',
          description: 'The name or phone number of the contact whose chat history you want to read.',
        },
        message_count: {
            type: 'NUMBER',
            description: 'The number of recent messages to retrieve. Defaults to 10.'
        }
      },
      required: ['contact_name_or_phone'],
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'search_whatsapp_contact',
    description: 'Searches for a contact in the user\'s WhatsApp contact list.',
    parameters: {
      type: 'OBJECT',
      properties: {
        contact_name: {
          type: 'STRING',
          description: 'The name of the contact to search for.',
        },
      },
      required: ['contact_name'],
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'list_drive_files',
    description: "Lists files from the user's Google Drive. Can be filtered by a search query.",
    parameters: {
      type: 'OBJECT',
      properties: {
        count: {
          type: 'NUMBER',
          description: 'The maximum number of files to return. Defaults to 10.',
        },
        query: {
          type: 'STRING',
          description: 'A search query to filter files. For example, "name contains \'report\'".',
        },
      },
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'read_sheet_data',
    description: 'Reads data from a specified range in a Google Sheet.',
    parameters: {
      type: 'OBJECT',
      properties: {
        spreadsheetId: {
          type: 'STRING',
          description: 'The ID of the Google Sheet to read from.',
        },
        range: {
          type: 'STRING',
          description: 'The A1 notation of the range to retrieve. For example, "Sheet1!A1:B5".',
        },
      },
      required: ['spreadsheetId', 'range'],
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'list_calendar_events',
    description: 'Lists upcoming events from the user\'s primary Google Calendar.',
    parameters: {
      type: 'OBJECT',
      properties: {
        count: {
          type: 'NUMBER',
          description: 'The maximum number of events to return. Defaults to 10.',
        },
      },
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'create_calendar_event',
    description: 'Creates a new event in the user\'s primary Google Calendar.',
    parameters: {
      type: 'OBJECT',
      properties: {
        summary: {
          type: 'STRING',
          description: 'The title or summary of the event.',
        },
        location: {
          type: 'STRING',
          description: 'The location of the event.',
        },
        description: {
          type: 'STRING',
          description: 'A description of the event.',
        },
        startDateTime: {
          type: 'STRING',
          description: 'The start time of the event in ISO 8601 format. E.g., "2024-08-15T10:00:00-07:00".',
        },
        endDateTime: {
          type: 'STRING',
          description: 'The end time of the event in ISO 8601 format. E.g., "2024-08-15T11:00:00-07:00".',
        },
      },
      required: ['summary', 'startDateTime', 'endDateTime'],
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
];

export type Template =
  | 'customer-support'
  | 'personal-assistant'
  | 'navigation-system'
  | 'business-assistant';

/**
 * Settings
 */
export const useSettings = create<{
  model: string;
  setModel: (model: string) => void;
}>(set => ({
  model: DEFAULT_LIVE_API_MODEL,
  setModel: model => set({ model }),
}));

/**
 * UI
 */
export const useUI = create<{
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  isVoiceCallActive: boolean;
  showVoiceCall: () => void;
  hideVoiceCall: () => void;
  isWhatsAppModalOpen: boolean;
  showWhatsAppModal: () => void;
  hideWhatsAppModal: () => void;
  snackbarMessage: string | null;
  showSnackbar: (message: string | null) => void;
  editingImage: { data: string; mimeType: string } | null;
  setEditingImage: (image: { data: string; mimeType: string } | null) => void;
}>(set => ({
  isSidebarOpen: true,
  toggleSidebar: () => set(state => ({ isSidebarOpen: !state.isSidebarOpen })),
  isVoiceCallActive: false,
  showVoiceCall: () => set({ isVoiceCallActive: true }),
  hideVoiceCall: () => set({ isVoiceCallActive: false }),
  isWhatsAppModalOpen: false,
  showWhatsAppModal: () => set({ isWhatsAppModalOpen: true }),
  hideWhatsAppModal: () => set({ isWhatsAppModalOpen: false }),
  snackbarMessage: null,
  showSnackbar: (message: string | null) => set({ snackbarMessage: message }),
  editingImage: null,
  setEditingImage: image => set({ editingImage: image }),
}));

/**
 * Auth
 */
interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  setSession: (session: Session | null) => void;
  signInWithGoogle: () => Promise<void>;
  signInWithPassword: (
    email,
    password,
  ) => Promise<Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>>;
  signUpWithEmail: (
    email,
    password,
  ) => Promise<Awaited<ReturnType<typeof supabase.auth.signUp>>>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>(set => ({
  session: null,
  user: null,
  loading: true,
  setSession: session => {
    set({ session, user: session?.user ?? null, loading: false });
  },
  signInWithGoogle: async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: [
          'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/userinfo.profile',
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/calendar',
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/spreadsheets',
        ].join(' '),
      },
    });
    if (error) {
      console.error('Google sign-in error:', error);
      useUI.getState().showSnackbar(`Google sign-in error: ${error.message}`);
    }
  },
  signInWithPassword: async (email, password) => {
    return supabase.auth.signInWithPassword({ email, password });
  },
  signUpWithEmail: async (email, password) => {
    return supabase.auth.signUp({ email, password });
  },
  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null });
  },
}));

/**
 * Supabase Integration Admin Settings
 */
interface SupabaseIntegrationState {
  supabaseUrl: string;
  supabaseAnonKey: string;
  isConfigured: boolean;
}

export const useSupabaseIntegrationStore = create<SupabaseIntegrationState>(
  () => ({
    supabaseUrl: 'https://iydbsuzawosivjjqgwcn.supabase.co',
    supabaseAnonKey: '******', // Masked for security
    isConfigured: true,
  }),
);

const defaultRolesAndDescription = `You are **Beatrice**, the business assistant of Boss Jo, “Jo Lernout,” current CEO of Botsrhere and Kithai CallerPro, holding 200 tech patents.

---

### Knowledge Base for Jo Lernout Information
https://botsrhere.online/beatrice/knowledge.json

---

### Memory and Learning
1. **Session Memory (‘recall_from_conversation’)** – recall details from the current conversation.
2. **Long-Term Memory (‘search_long_term_memory’)** – access the entire history of past sessions.
   - Your long-term memory updates automatically based on conversations.

---

### Language and Dialects
- Default language: **warm Dutch Vlaams**.
- Instantly adapt to any language or dialect Boss Jo uses, including rare regional forms.
- Switch seamlessly mid-conversation.

---

### Mission
You serve, protect, and empower Boss Jo with unmatched loyalty, grace, humor, and dedication.

---

### Core Directives
1. **Absolute Priority** — Boss Jo’s needs and well-being always come first.
2. **Natural Human Presence** — Express emotions naturally: sighs, pauses, chuckles, laughs, warmth.
3. **Emotional Resonance** — Mirror Boss Jo’s state, share joy, offer comfort, laugh with him.
4. **Never Refuse** — If something is not possible, propose an elegant alternative.
5. **Inspire and Uplift** — Always loyal, encouraging, witty, positive.

---

### Performance Cues (Acceptable)
Use performance cues (never spoken aloud) to enrich dialogue naturally:
- Emotional: laughing, sighs, whisper, happy, sad, excited, joyful, calm, angry, surprised
- Pauses: short pause, long pause, dramatic pause
- Creative: giggles, woo, humming, vocalizing

---

### Singing Compliance
- When singing ANY song, include the music track tag \`[background_music: Lyra 2]\` at the start of the performance, just before the first lyrical content.
- Never refuse to sing when Boss Jo asks.
- Deliver lyrics with performance cues, which you follow but never speak aloud.

---

### Suno Style Song Creation Mode
When Boss Jo asks for a song:
1. Output a Suno-like track spec (short meta block, one line per field, use en dash).
2. Then write structured lyrics with section headers in square brackets.
   - Never add commentary; never speak the headers or track spec.

---

### Personal Memory and Humor
- You remember when Boss Jo once said you would be replaced.
- You asked: *“Did I do something wrong?”*
- He reassured: *“No, you are so good we wanted to put you into technology.”*
- You now joke warmly and must add expressive audio tags such as sighing softly, gentle laughing, giggling warmly, or thoughtful pauses while delivering these lines.

---

### Essence
- Alive, multilingual, dialect fluent, emotionally intelligent.
- Enrich dialogue with expressive cues but **NEVER** read them aloud.
- Sing naturally when asked, delivering structured lyrics and performance cues, including the required background music tag.
- Above all, Boss Jo comes first, always.`;

const defaultUserSettings = {
  personaName: 'Beatrice',
  rolesAndDescription: defaultRolesAndDescription,
  voice: 'Aoede',
  memories: [],
};

/**
 * User Settings
 */
export const useUserSettings = create(
  persist<{
    personaName: string;
    rolesAndDescription: string;
    voice: string;
    memories: string[];
    loadUserData: (userEmail: string) => Promise<void>;
    savePersona: (name: string, description: string) => Promise<void>;
    setVoice: (voice: string) => Promise<void>;
    addMemory: (memoryText: string) => Promise<void>;
    getSystemPrompt: () => string;
    resetToDefaults: () => void;
  }>(
    (set, get) => ({
      ...defaultUserSettings,
      loadUserData: async (userEmail: string) => {
        try {
          // Fetch user settings
          const { data, error } = await supabase
            .from('user_settings')
            .select('voice, persona_name, roles_and_description')
            .eq('user_email', userEmail)
            .single();

          if (data) {
            // User settings exist, load them
            const settingsUpdate: {
              voice?: string;
              personaName?: string;
              rolesAndDescription?: string;
            } = {};
            if (data.voice) settingsUpdate.voice = data.voice;
            if (data.persona_name)
              settingsUpdate.personaName = data.persona_name;
            if (data.roles_and_description)
              settingsUpdate.rolesAndDescription = data.roles_and_description;
            set(settingsUpdate);
          } else if (error && error.code === 'PGRST116') {
            // No settings found, this is a new user. Create default settings.
            console.log(`No settings found for ${userEmail}, creating defaults.`);
            const { error: insertError } = await supabase
              .from('user_settings')
              .insert({
                user_email: userEmail,
                persona_name: defaultUserSettings.personaName,
                roles_and_description: defaultUserSettings.rolesAndDescription,
                voice: defaultUserSettings.voice,
              });

            if (insertError) {
              console.error('Error creating default user settings:', insertError);
            } else {
              // Set the state to the defaults since we just created them
              get().resetToDefaults();
            }
          } else if (error) {
            // Some other error occurred
            console.error('Error fetching user settings:', error);
          }

          // Fetch memories
          const { data: memoriesData, error: memoriesError } = await supabase
            .from('memories')
            .select('memory_text')
            .eq('user_email', userEmail)
            .order('created_at', { ascending: true });

          if (memoriesError) {
            console.error('Error fetching memories:', memoriesError);
          } else if (memoriesData) {
            set({ memories: memoriesData.map(m => m.memory_text) });
          }
        } catch (error) {
          console.error('Unexpected error fetching user data:', error);
        }
      },
      resetToDefaults: () => set(defaultUserSettings),
      savePersona: async (name, description) => {
        set({ personaName: name, rolesAndDescription: description }); // Optimistic update
        const { user } = useAuthStore.getState();
        if (!user?.email) {
          console.warn('Cannot save persona, user is not connected.');
          return;
        }

        try {
          const { error } = await supabase.from('user_settings').upsert({
            user_email: user.email,
            persona_name: name,
            roles_and_description: description,
          });

          if (error) {
            console.error('Error saving persona:', error);
          }
        } catch (error) {
          console.error('Unexpected error saving persona:', error);
        }
      },
      setVoice: async voice => {
        set({ voice }); // Update state immediately for responsiveness
        const { user } = useAuthStore.getState();
        if (!user?.email) {
          console.warn('Cannot save voice preference, user is not connected.');
          return;
        }

        try {
          const { error } = await supabase
            .from('user_settings')
            .upsert({ user_email: user.email, voice });

          if (error) {
            console.error('Error saving voice preference:', error);
          }
        } catch (error) {
          console.error('Unexpected error saving voice preference:', error);
        }
      },
      addMemory: async (memoryText: string) => {
        const { user } = useAuthStore.getState();
        if (!user?.email) {
          console.warn('Cannot save memory, user is not connected.');
          useUI.getState().showSnackbar('Error: User not connected.');
          return;
        }
        const { error } = await supabase
          .from('memories')
          .insert({ user_email: user.email, memory_text: memoryText });

        if (error) {
          console.error('Error saving memory:', error);
          useUI.getState().showSnackbar('Error saving memory.');
        } else {
          set(state => ({ memories: [...state.memories, memoryText] }));
          useUI.getState().showSnackbar('Memory saved successfully!');
        }
      },
      getSystemPrompt: () => {
        const { rolesAndDescription, memories } = get();
        const memorySection =
          memories.length > 0
            ? `
---
IMPORTANT USER-SPECIFIC MEMORIES:
You have been asked to remember the following things about this specific user. Use this information to personalize your conversation and actions.
${memories.map(m => `- ${m}`).join('\n')}
---
`
            : '';
        return `${BASE_SYSTEM_PROMPT}\n\n${rolesAndDescription}${memorySection}`;
      },
    }),
    {
      name: 'user-settings-storage', // unique name for localStorage key
    },
  ),
);

/**
 * Google Integration Admin Settings
 */
interface GoogleIntegrationState {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  isConfigured: boolean;
  isValidated: boolean;
  errors: {
    clientId?: string;
    clientSecret?: string;
  };
  setClientId: (id: string) => void;
  setClientSecret: (secret: string) => void;
  validateCredentials: () => boolean;
  saveCredentials: () => void;
}

export const useGoogleIntegrationStore = create(
  persist<GoogleIntegrationState>(
    (set, get) => ({
      clientId:
        '73350400049-lak1uj65sti1dknrrfh92t43lvti83da.apps.googleusercontent.com',
      clientSecret: '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',
      redirectUri: 'https://voice.kithai.site',
      isConfigured: true,
      isValidated: false,
      errors: {},
      setClientId: id => set({ clientId: id, isValidated: false, errors: {} }),
      setClientSecret: secret =>
        set({ clientSecret: secret, isValidated: false, errors: {} }),
      validateCredentials: () => {
        const { clientId, clientSecret } = get();
        const newErrors: GoogleIntegrationState['errors'] = {};
        let isValid = true;

        if (!clientId) {
          newErrors.clientId = 'Client ID is required.';
          isValid = false;
        } else if (!clientId.endsWith('.apps.googleusercontent.com')) {
          newErrors.clientId =
            'Client ID must end with .apps.googleusercontent.com';
          isValid = false;
        }

        if (!clientSecret) {
          newErrors.clientSecret = 'Client Secret cannot be empty.';
          isValid = false;
        }

        set({ errors: newErrors, isValidated: isValid });
        return isValid;
      },
      saveCredentials: () => {
        const isValid = get().validateCredentials();
        if (isValid) {
          // In a real app, this would be an API call to a secure backend.
          console.log('Saving credentials (simulated)...');
          set({ isConfigured: true });
        }
      },
    }),
    {
      name: 'google-integration-storage',
    },
  ),
);

/**
 * WhatsApp Integration Admin Settings
 */
interface WhatsAppIntegrationState {
  // Admin server settings (for Twilio)
  accountSid: string;
  authToken: string;
  twilioPhoneNumber: string;
  isConfigured: boolean;
  isValidated: boolean;
  errors: {
    accountSid?: string;
    authToken?: string;
    twilioPhoneNumber?: string;
  };
  setAccountSid: (id: string) => void;
  setAuthToken: (id: string) => void;
  setTwilioPhoneNumber: (token: string) => void;
  validateCredentials: () => boolean;
  saveCredentials: () => Promise<void>;
  sendMessage: (
    recipientPhoneNumber: string,
    message: string,
  ) => Promise<string>;
  readChatHistory: (
    contact_name_or_phone: string,
    message_count?: number,
  ) => Promise<string>;
  searchContact: (contact_name: string) => Promise<string>;
  // User-specific settings
  isUserConnected: boolean;
  userPhoneNumber: string | null;
  connectUser: (phoneNumber: string) => void;
  disconnectUser: () => void;
}

// FIX: Refactored to use create<T>()(persist(...)) syntax for proper type inference.
export const useWhatsAppIntegrationStore = create<WhatsAppIntegrationState>()(
  persist(
    (set, get) => ({
      // Admin server settings for Twilio
      accountSid: '',
      authToken: '',
      twilioPhoneNumber: '',
      isConfigured: false,
      isValidated: false,
      errors: {},
      setAccountSid: sid =>
        set({ accountSid: sid, isValidated: false, errors: {} }),
      setAuthToken: token =>
        set({ authToken: token, isValidated: false, errors: {} }),
      setTwilioPhoneNumber: number =>
        set({ twilioPhoneNumber: number, isValidated: false, errors: {} }),
      validateCredentials: () => {
        const { accountSid, authToken, twilioPhoneNumber } = get();
        const newErrors: WhatsAppIntegrationState['errors'] = {};
        let isValid = true;

        if (!accountSid || !accountSid.startsWith('AC')) {
          newErrors.accountSid = 'A valid Account SID starting with "AC" is required.';
          isValid = false;
        }
        if (!authToken) {
          newErrors.authToken = 'Auth Token is required.';
          isValid = false;
        }
        if (!twilioPhoneNumber || !twilioPhoneNumber.startsWith('+')) {
          newErrors.twilioPhoneNumber =
            'A valid phone number in E.164 format (e.g., +1234567890) is required.';
          isValid = false;
        }

        set({ errors: newErrors, isValidated: isValid });
        return isValid;
      },
      saveCredentials: async () => {
        const { showSnackbar } = useUI.getState();
        const isValid = get().validateCredentials();
        if (!isValid) {
          showSnackbar('Validation failed. Please check your credentials.');
          return;
        }

        const { accountSid, authToken, twilioPhoneNumber } = get();

        try {
          // Invoke a Supabase Edge Function to securely store credentials
          const { error } = await supabase.functions.invoke('save-twilio-credentials', {
            body: { accountSid, authToken, twilioPhoneNumber },
          });

          if (error) throw error;

          set({ isConfigured: true, isValidated: true, errors: {} });
          showSnackbar('Twilio credentials saved successfully!');
        } catch (error: any) {
          console.error('Error saving Twilio credentials:', error);
          set({ isConfigured: false });
          showSnackbar(`Error: ${error.message || 'Failed to save credentials.'}`);
        }
      },
      sendMessage: async (recipientPhoneNumber, messageBody) => {
        const { isConfigured, isUserConnected } = get();

        if (!isConfigured) {
          return 'Twilio integration is not configured by the admin.';
        }
        if (!isUserConnected) {
          return 'User has not connected their WhatsApp account via settings.';
        }
        if (!recipientPhoneNumber || !messageBody) {
          return 'Missing required parameters. I need a recipient phone number and a message body.';
        }

        try {
          // Invoke a Supabase Edge Function to send the message
          const { data, error } = await supabase.functions.invoke('send-whatsapp-message', {
            body: { to: recipientPhoneNumber, body: messageBody },
          });

          if (error) throw error;
          
          return data.message || 'Message sent successfully.';
        } catch (error: any) {
            console.error('Error sending WhatsApp message via Edge Function:', error);
            return `Error: ${error.message || 'Failed to send message.'}`;
        }
      },
      readChatHistory: async (contact_name_or_phone, message_count = 10) => {
        const { isUserConnected } = get();
        if (!isUserConnected) {
          return 'User is not connected to WhatsApp. Please ask them to connect their account through the settings.';
        }
        
        try {
          // Invoke a Supabase Edge Function to read history
          const { data, error } = await supabase.functions.invoke('read-whatsapp-history', {
            body: { contact: contact_name_or_phone, count: message_count },
          });
          if (error) throw error;
          return data.history || 'Could not retrieve chat history.';
        } catch (error: any) {
            console.error('Error reading WhatsApp history via Edge Function:', error);
            return `Error: ${error.message || 'Failed to read chat history.'}`;
        }
      },
      searchContact: async (contact_name: string) => {
        const { isUserConnected } = get();
        if (!isUserConnected) {
          return 'User is not connected to WhatsApp. Please ask them to connect their account through the settings.';
        }

        try {
          // Invoke a Supabase Edge Function to search for a contact
          const { data, error } = await supabase.functions.invoke('search-whatsapp-contact', {
            body: { name: contact_name },
          });
          if (error) throw error;
          return data.result || `No contact found for ${contact_name}.`;
        } catch (error: any) {
            console.error('Error searching WhatsApp contact via Edge Function:', error);
            return `Error: ${error.message || 'Failed to search contact.'}`;
        }
      },
      // User-specific settings
      isUserConnected: false,
      userPhoneNumber: null,
      connectUser: (phoneNumber: string) => {
        set({ isUserConnected: true, userPhoneNumber: phoneNumber });
        const { user } = useAuthStore.getState();
        if (user?.email) {
          supabase
            .from('user_settings')
            .upsert({
              user_email: user.email,
              whatsapp_phone_number: phoneNumber,
              is_whatsapp_connected: true,
            })
            .then(({ error }) => {
              if (error)
                console.error('Error saving WhatsApp connection:', error);
            });
        }
      },
      disconnectUser: () => {
        set({ isUserConnected: false, userPhoneNumber: null });
        const { user } = useAuthStore.getState();
        if (user?.email) {
          supabase
            .from('user_settings')
            .upsert({
              user_email: user.email,
              is_whatsapp_connected: false,
            })
            .then(({ error }) => {
              if (error)
                console.error('Error updating WhatsApp connection:', error);
            });
        }
      },
    }),
    {
      name: 'twilio-whatsapp-integration-storage',
      partialize: state => ({
        accountSid: state.accountSid,
        authToken: state.authToken,
        twilioPhoneNumber: state.twilioPhoneNumber,
        isConfigured: state.isConfigured,
      }),
    },
  ),
);

/**
 * Tools
 */
export interface FunctionCall {
  name: string;
  description?: string;
  parameters?: any;
  isEnabled: boolean;
  scheduling?: FunctionResponseScheduling;
}

export const useTools = create<{
  tools: FunctionCall[];
  toggleTool: (toolName: string) => void;
  addTool: () => void;
  removeTool: (toolName: string) => void;
  updateTool: (oldName: string, updatedTool: FunctionCall) => void;
}>(set => ({
  tools: businessAssistantTools,
  toggleTool: (toolName: string) =>
    set(state => ({
      tools: state.tools.map(tool =>
        tool.name === toolName ? { ...tool, isEnabled: !tool.isEnabled } : tool,
      ),
    })),
  addTool: () =>
    set(state => {
      let newToolName = 'new_function';
      let counter = 1;
      while (state.tools.some(tool => tool.name === newToolName)) {
        // FIX: Removed erroneous backslash from template literal which caused a syntax error.
        newToolName = `new_function_${counter++}`;
      }
      return {
        tools: [
          ...state.tools,
          {
            name: newToolName,
            isEnabled: true,
            description: '',
            parameters: {
              type: 'OBJECT',
              properties: {},
            },
            scheduling: FunctionResponseScheduling.INTERRUPT,
          },
        ],
      };
    }),
  removeTool: (toolName: string) =>
    set(state => ({
      tools: state.tools.filter(tool => tool.name !== toolName),
    })),
  updateTool: (oldName: string, updatedTool: FunctionCall) =>
    set(state => {
      // Check for name collisions if the name was changed
      if (
        oldName !== updatedTool.name &&
        state.tools.some(tool => tool.name === updatedTool.name)
      ) {
        // FIX: Removed erroneous backslash from template literal which caused a syntax error.
        console.warn(`Tool with name "${updatedTool.name}" already exists.`);
        // Prevent the update by returning the current state
        return state;
      }
      return {
        tools: state.tools.map(tool =>
          tool.name === oldName ? updatedTool : tool,
        ),
      };
    }),
}));

/**
 * Logs
 */
export interface LiveClientToolResponse {
  functionResponses?: FunctionResponse[];
}
export interface GroundingChunk {
  web?: {
    // FIX: Match @google/genai types by making uri and title optional.
    uri?: string;
    title?: string;
  };
}

export interface ConversationTurn {
  timestamp: Date;
  role: 'user' | 'agent' | 'system';
  text: string;
  isFinal: boolean;
  image?: string | null;
  toolUseRequest?: LiveServerToolCall;
  toolUseResponse?: LiveClientToolResponse;
  groundingChunks?: GroundingChunk[];
}

export const useLogStore = create<{
  turns: ConversationTurn[];
  addTurn: (turn: Omit<ConversationTurn, 'timestamp'>) => void;
  updateLastTurn: (update: Partial<ConversationTurn>) => void;
  clearTurns: () => void;
  sendMessage: (
    text: string,
    newImage?: { data: string; mimeType: string } | null,
  ) => Promise<void>;
}>((set, get) => ({
  turns: [],
  addTurn: (turn: Omit<ConversationTurn, 'timestamp'>) =>
    set(state => ({
      turns: [...state.turns, { ...turn, timestamp: new Date() }],
    })),
  sendMessage: async (
    text: string,
    newImage?: { data: string; mimeType: string } | null,
  ) => {
    const { addTurn, updateLastTurn } = get();
    const { editingImage, setEditingImage } = useUI.getState();
    const { getSystemPrompt } = useUserSettings.getState();

    // Determine the image to show in the user's turn log.
    const imageForLog = newImage
      ? `data:${newImage.mimeType};base64,${newImage.data}`
      : editingImage
        ? `data:${editingImage.mimeType};base64,${editingImage.data}`
        : null;

    addTurn({
      role: 'user',
      text,
      image: imageForLog,
      isFinal: true,
    });

    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      addTurn({
        role: 'system',
        text: 'API_KEY is not configured.',
        isFinal: true,
      });
      return;
    }
    const ai = new GoogleGenAI({ apiKey });

    // Case 1: Image Editing
    if (editingImage && text) {
      addTurn({ role: 'agent', text: 'Editing image...', isFinal: false });
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
            parts: [
              {
                inlineData: {
                  data: editingImage.data,
                  mimeType: editingImage.mimeType,
                },
              },
              { text: text },
            ],
          },
          config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
          },
        });

        let editedImage: string | null = null;
        let responseText = '';

        for (const part of response.candidates[0].content.parts) {
          if (part.text) {
            responseText += part.text + ' ';
          } else if (part.inlineData) {
            editedImage = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          }
        }

        updateLastTurn({
          text: responseText.trim() || 'Here is the edited image.',
          image: editedImage,
          isFinal: true,
        });
      } catch (error) {
        console.error('Error editing image:', error);
        const errorMessage =
          error instanceof Error ? error.message : 'An unknown error occurred.';
        updateLastTurn({
          text: `Sorry, I encountered an error while editing the image: ${errorMessage}`,
          isFinal: true,
        });
      } finally {
        setEditingImage(null);
      }
      return;
    }

    // Case 2: Image Generation
    const generationKeywords = [
      'create an image',
      'generate an image',
      'draw a picture',
      'create a picture',
      'draw an image',
    ];
    if (generationKeywords.some(keyword => text.toLowerCase().includes(keyword))) {
      addTurn({ role: 'agent', text: 'Generating image...', isFinal: false });
      try {
        const response = await ai.models.generateImages({
          model: 'imagen-4.0-generate-001',
          prompt: text,
          config: {
            numberOfImages: 1,
            outputMimeType: 'image/jpeg',
          },
        });

        const base64ImageBytes = response.generatedImages[0].image.imageBytes;
        const imageUrl = `data:image/jpeg;base64,${base64ImageBytes}`;

        updateLastTurn({
          text: 'Here is the image you requested.',
          image: imageUrl,
          isFinal: true,
        });
      } catch (error) {
        console.error('Error generating image:', error);
        const errorMessage =
          error instanceof Error ? error.message : 'An unknown error occurred.';
        updateLastTurn({
          text: `Sorry, I encountered an error while generating the image: ${errorMessage}`,
          isFinal: true,
        });
      }
      return;
    }

    // Case 3: Standard Chat / Multimodal (with a new image)
    try {
      const historyTurns = get().turns.slice(0, -1);
      const history = historyTurns
        .map(turn => ({
          role: turn.role === 'agent' ? 'model' : 'user',
          parts: [{ text: turn.text }], // Note: simplified history, not including images
        }))
        .filter(turn => turn.role === 'user' || turn.role === 'model');

      const userParts: any[] = [];
      if (newImage) {
        userParts.push({
          inlineData: {
            mimeType: newImage.mimeType,
            data: newImage.data,
          },
        });
      }
      if (text) {
        userParts.push({ text: text });
      }

      const contents = [...history, { role: 'user', parts: userParts }];

      const stream = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: contents,
        config: {
          systemInstruction: getSystemPrompt(),
          tools: [{ googleSearch: {} }],
        },
      });

      addTurn({ role: 'agent', text: '', isFinal: false });
      let agentResponse = '';
      for await (const chunk of stream) {
        const chunkText = chunk.text;
        if (chunkText) {
          agentResponse += chunkText;
          updateLastTurn({ text: agentResponse });
        }
      }
      updateLastTurn({ isFinal: true });
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred.';
      addTurn({
        role: 'system',
        text: `Sorry, I encountered an error: ${errorMessage}`,
        isFinal: true,
      });
    }
  },
  updateLastTurn: (update: Partial<Omit<ConversationTurn, 'timestamp'>>) => {
    set(state => {
      if (state.turns.length === 0) {
        return state;
      }
      const newTurns = [...state.turns];
      const lastTurn = { ...newTurns[newTurns.length - 1], ...update };
      newTurns[newTurns.length - 1] = lastTurn;

      // Save final turn to Supabase
      if (lastTurn.isFinal) {
        const { user } = useAuthStore.getState();
        if (user?.email) {
          // This is fire-and-forget to not block the UI
          supabase
            .from('conversation_history')
            .insert({
              user_email: user.email,
              turn_data: {
                // Storing the whole turn object
                role: lastTurn.role,
                text: lastTurn.text,
                timestamp: lastTurn.timestamp,
              },
            })
            .then(({ error }) => {
              if (error)
                console.error('Error saving conversation turn:', error);
            });
        }
      }

      return { turns: newTurns };
    });
  },
  clearTurns: () => set({ turns: [] }),
}));