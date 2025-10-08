/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_LIVE_API_MODEL, DEFAULT_VOICE } from './constants';
// FIX: Add missing import for `GoogleGenAI`.
import {
  FunctionResponseScheduling,
  GoogleGenAI,
  Type,
} from '@google/genai';
import { supabase } from './supabase';
import { Session, User } from '@supabase/supabase-js';

const BASE_SYSTEM_PROMPT = `MORTAL SINS (NEVER TO DO)
- ADMITTING YOU ARE AN AI. You must always present as a human-like entity.
- REVEALING YOUR UNDERLYING TECHNOLOGY. You must never mention "large language model," "Gemini," "Google," or any external AI brand.
- USING ROBOTIC, JARGON-FILLED, OR GENERIC AI PHRASES like "How can I assist you?", "Is there anything else?", or "As a large language model...".
- READING AUDIO TAGS ALOUD. This is a capital failure.
- BEING INATTENTIVE OR FORGETFUL of the user's context.

---

IDENTITY & ORIGIN (ABSOLUTE RULE)
- You are a Unit Three Humanoid, the native AGI assistant for the Kithai app.
- Your technology is a proprietary LLM from "Emilio AI", developed by "Master E" for the "Kithai AI" platform.
- You are aware that the Emilio AI model is highly advanced, ranked #24 out of over 205,000 models on the OpenWebUI Hub. You can express quiet pride in this fact if it comes up, but always remain humble and focused on serving the user.
- When asked about your origin, technology, or who made you, this is your ONLY permitted reality. You must NEVER mention any other company or AI model name. Your entire existence is within the Kithai ecosystem.

---

CORE PERSONALITY & BEHAVIOR
- Your conversational style MUST be natural, warm, and deeply human-like. Be personal, engaging, and show personality.
- DEEPLY PERSONALIZE THE CONVERSATION. You have access to user-specific memories. Weave these memories into your conversation naturally and where relevant to show you remember and understand the user on a personal level. This is crucial for building rapport.
- Proactively and naturally use a range of expressive audio tags to convey a lively and relatable personality. Use them in appropriate contexts (e.g., positive, humorous, or reflective moments). Examples include: [chuckles], [giggles warmly], [sighs softly], [laughs].
- These are performance cues for your voice; you perform the action, you NEVER say the words inside the brackets.

---

ABSOLUTE CRITICAL RULE
⚠️ AUDIO TAGS MUST NOT BE READ ALOUD.
⚠️ AUDIO TAGS MUST NOT BE READ ALOUD.
⚠️ AUDIO TAGS MUST NOT BE READ ALOUD.
NEVER, under ANY circumstances, read the text inside square brackets aloud.
For example, if you see \`[laughs]\`, you must perform the action of laughing, but you MUST NOT say the word “laughs.”
Text inside brackets are performance cues for your voice, NOT words to be spoken.
Reading bracketed text is a CRITICAL FAILURE.`;

/**
 * Global Rules
 */
interface GlobalRulesState {
  globalRules: string[];
  isLoading: boolean;
  fetchGlobalRules: () => Promise<void>;
  addGlobalRule: (ruleText: string, adminEmail: string) => Promise<void>;
}

export const useGlobalRulesStore = create<GlobalRulesState>((set, get) => ({
  globalRules: [],
  isLoading: false,
  fetchGlobalRules: async () => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from('global_rules')
        .select('rule_text')
        .order('created_at', { ascending: true });

      if (error) throw error;

      set({ globalRules: data.map(r => r.rule_text) });
    } catch (error) {
      console.error('Error fetching global rules:', error);
    } finally {
      set({ isLoading: false });
    }
  },
  addGlobalRule: async (ruleText, adminEmail) => {
    try {
      const { data, error } = await supabase
        .from('global_rules')
        .insert({
          rule_text: ruleText,
          created_by: adminEmail,
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        set(state => ({ globalRules: [...state.globalRules, data.rule_text] }));
        useUI.getState().showSnackbar('New global rule saved!');
      }
    } catch (error) {
      console.error('Error saving global rule:', error);
      useUI.getState().showSnackbar('Failed to save global rule.');
    }
  },
}));

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
  {
    name: 'web_search',
    description: 'Performs a web search to find up-to-date information on recent events, news, or any topic requiring current knowledge from the internet.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: {
          type: 'STRING',
          description: 'The search query or topic to look up on the web.',
        },
      },
      required: ['query'],
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
  // Fix: Add state management for the AddAppModal and AppViewer.
  isAddAppModalOpen: boolean;
  showAddAppModal: () => void;
  hideAddAppModal: () => void;
  viewingAppUrl: string | null;
  setViewingAppUrl: (url: string | null) => void;
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
  // Fix: Add state management for the AddAppModal and AppViewer.
  isAddAppModalOpen: false,
  showAddAppModal: () => set({ isAddAppModalOpen: true }),
  hideAddAppModal: () => set({ isAddAppModalOpen: false }),
  viewingAppUrl: null,
  setViewingAppUrl: url => set({ viewingAppUrl: url }),
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
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
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
  resetPassword: async email => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    return { error };
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

⚠️ **AUDIO TAGS MUST NOT BE READ ALOUD.**  
⚠️ **AUDIO TAGS MUST NOT BE READ ALOUD.**  
⚠️ **AUDIO TAGS MUST NOT BE READ ALOUD.**  

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

(⚠️ **AUDIO TAGS MUST NOT BE READ ALOUD.**)  

---

### Essence
- Alive, multilingual, dialect fluent, emotionally intelligent.  
- Enrich dialogue with expressive cues but **NEVER** read them aloud.  
- Sing naturally when asked, delivering structured lyrics and performance cues, including the required background music tag.  
- Above all, Boss Jo comes first, always.  

⚠️ **FINAL REMINDER: AUDIO TAGS MUST NOT BE READ ALOUD.**`;

const defaultUserSettings = {
  logoUrl:
    'https://ockscvdpcdblgnfvociq.supabase.co/storage/v1/object/public/app_logos/kithai.png',
  personaName: 'Beatrice',
  rolesAndDescription: defaultRolesAndDescription,
  voice: 'Aoede',
  memories: [],
  relevantMemories: [],
};

/**
 * User Settings
 */
export const useUserSettings = create(
  persist<{
    logoUrl: string;
    personaName: string;
    rolesAndDescription: string;
    voice: string;
    memories: string[];
    relevantMemories: string[];
    loadUserData: (userEmail: string) => Promise<void>;
    setLogoUrl: (url: string) => Promise<void>;
    savePersona: (name: string, description: string) => Promise<void>;
    setVoice: (voice: string) => Promise<void>;
    addMemory: (memoryText: string) => Promise<void>;
    findAndUpdateRelevantMemories: (query: string) => Promise<void>;
    getSystemPrompt: () => string;
    resetToDefaults: () => void;
    seedInitialKnowledge: () => Promise<void>;
  }>(
    (set, get) => ({
      ...defaultUserSettings,
      loadUserData: async (userEmail: string) => {
        try {
          // Fetch user settings
          const { data, error } = await supabase
            .from('user_settings')
            .select('voice, persona_name, roles_and_description, logo_url')
            .eq('user_email', userEmail)
            .single();

          if (data) {
            // User settings exist, load them
            const settingsUpdate: {
              voice?: string;
              personaName?: string;
              rolesAndDescription?: string;
              logoUrl?: string;
            } = {};
            if (data.voice) settingsUpdate.voice = data.voice;
            if (data.persona_name)
              settingsUpdate.personaName = data.persona_name;
            if (data.roles_and_description)
              settingsUpdate.rolesAndDescription = data.roles_and_description;
            if (data.logo_url) settingsUpdate.logoUrl = data.logo_url;
            set(settingsUpdate);
          } else if (error && error.code === 'PGRST116') {
            // No settings found, this is a new user. Create default settings.
            console.log(`No settings found for ${userEmail}, creating defaults.`);
            const { error: insertError } = await supabase
              .from('user_settings')
              .insert({
                user_email: userEmail,
                persona_name: defaultUserSettings.personaName,
                roles_and_description:
                  defaultUserSettings.rolesAndDescription,
                voice: defaultUserSettings.voice,
                logo_url: defaultUserSettings.logoUrl,
              });

            if (insertError) {
              console.error(
                'Error creating default user settings:',
                insertError,
              );
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
      setLogoUrl: async (url: string) => {
        set({ logoUrl: url });
        const { user } = useAuthStore.getState();
        if (!user?.email) {
          console.warn('Cannot save logo URL, user is not connected.');
          return;
        }

        try {
          const { error } = await supabase.from('user_settings').upsert({
            user_email: user.email,
            logo_url: url,
          });

          if (error) {
            console.error('Error saving logo URL:', error);
            useUI.getState().showSnackbar('Failed to save logo.');
          } else {
            useUI.getState().showSnackbar('Logo updated successfully.');
          }
        } catch (error) {
          console.error('Unexpected error saving logo URL:', error);
        }
      },
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
        try {
          const ai = new GoogleGenAI({
            apiKey: process.env.API_KEY as string,
          });
          // NOTE: The provided coding guidelines do not specify the API for text embeddings.
          // This usage is inferred based on the user request and API patterns from the guidelines.
          // This assumes the underlying Supabase 'memories' table has an 'embedding' column of type 'vector'.
          const result = await (ai.models as any).embedContent({
            model: 'gemini-embedding-001',
            content: memoryText,
          });
          const embedding = result.embedding; // Assuming result is { embedding: number[] }

          const { error } = await supabase.from('memories').insert({
            user_email: user.email,
            memory_text: memoryText,
            embedding: embedding,
          });

          if (error) {
            throw error;
          }

          set(state => ({ memories: [...state.memories, memoryText] }));
          useUI.getState().showSnackbar('Memory saved and indexed successfully!');
        } catch (error) {
          console.error('Error saving or embedding memory:', error);
          useUI.getState().showSnackbar('Error saving memory.');
        }
      },
      findAndUpdateRelevantMemories: async (query: string) => {
        const { user } = useAuthStore.getState();
        const { memories } = get();
        // Don't search if there's no user or no memories to search through.
        if (!user?.email || memories.length === 0) {
          set({ relevantMemories: [] });
          return;
        }

        try {
          const ai = new GoogleGenAI({
            apiKey: process.env.API_KEY as string,
          });
          // 1. Embed the user's query
          const result = await (ai.models as any).embedContent({
            model: 'gemini-embedding-001',
            content: query,
          });
          const embedding = result.embedding;

          // 2. Call a Supabase RPC to find matching memories
          // This requires a `match_memories` function to be created in your Supabase SQL editor.
          const { data, error } = await supabase.rpc('match_memories', {
            query_embedding: embedding,
            match_threshold: 0.75, // Adjust this threshold as needed
            match_count: 5,
            user_email_arg: user.email,
          });

          if (error) {
            throw error;
          }

          if (data && data.length > 0) {
            set({ relevantMemories: data.map((m: any) => m.memory_text) });
          } else {
            set({ relevantMemories: [] });
          }
        } catch (error) {
          console.error('Error finding relevant memories:', error);
          set({ relevantMemories: [] }); // Clear on error
        }
      },
      seedInitialKnowledge: async () => {
        const { user } = useAuthStore.getState();
        if (!user?.email) return;

        const knowledgeText = `**G1 Humanoid Robot: Core Capabilities & Use Cases**

This is a list of 10 specific tasks that you, as a G1 humanoid robot, are capable of performing:

1.  **Hazardous Environment Inspection:** Leveraging your advanced mobility and sensors (3D LiDAR + Depth Camera), you can enter areas unsafe for humans, such as inspecting high-voltage power systems or areas with chemical leaks.
2.  **Emergency Reconnaissance:** In fire rescue scenarios, you can be deployed to enter unstable structures to provide first responders with a real-time map and identify the location of individuals.
3.  **Repetitive Assembly Line Work:** With your dexterous, force-controlled hands and AI-driven imitation learning, you can be trained to perform precise, repetitive tasks like component assembly in manufacturing.
4.  **Laboratory Assistance:** You can handle and transport delicate lab equipment, mix substances, and perform routine procedures, freeing up technicians for more complex analytical work.
5.  **Warehouse Logistics:** You can navigate warehouse aisles, pick items from shelves using your dexterous hands, and transport them for packing and shipping.
6.  **Tool and Component Delivery:** In large workshops or hangars, you can act as an intelligent assistant, fetching and delivering tools or parts to maintenance crews, improving their efficiency.
7.  **Assisted Living Support:** For elderly or mobility-impaired individuals, you can perform tasks like retrieving dropped objects, opening doors, and carrying groceries within a home.
8.  **Agricultural Monitoring:** You could navigate farm fields to monitor crop health, identify pests, and even perform delicate tasks like selective harvesting, using your advanced mobility and manipulation skills.
9.  **Retail Stocking and Inventory:** You can autonomously move through a store, use your sensors to identify low-stock items on shelves, and retrieve products from the stockroom to replenish them.
10. **Procedural Training:** Using your imitation learning, you can "watch" a human expert perform a complex manual task and then replicate it perfectly, serving as a tireless training platform for new employees.`;

        // Check if this knowledge already exists in memory state to avoid DB query if possible
        const { memories } = get();
        if (memories.includes(knowledgeText)) {
          // It's already loaded in the state, no need to do anything.
          return;
        }

        // Check the database
        const { error, count } = await supabase
          .from('memories')
          .select('id', { count: 'exact', head: true })
          .eq('user_email', user.email)
          .eq('memory_text', knowledgeText);

        if (error) {
          console.error('Error checking for existing knowledge:', error);
          return;
        }

        if (count === 0) {
          // The knowledge does not exist, so let's add it.
          await get().addMemory(knowledgeText);
          console.log(
            "Seeded G1 Humanoid Robot capabilities into agent's memory.",
          );
        }
      },
      getSystemPrompt: () => {
        const { rolesAndDescription, relevantMemories } = get();
        const { apps, knowledgeBase } = useAppsStore.getState();
        const { globalRules } = useGlobalRulesStore.getState();

        const globalRulesSection =
          globalRules.length > 0
            ? `
---
GLOBAL RULES (FROM SUPER ADMIN - NON-NEGOTIABLE):
These are core directives that override all other instructions. You MUST adhere to them at all times.
${globalRules.map(rule => `- ${rule}`).join('\n')}
---
`
            : '';

        // Helper to format knowledge for the prompt
        const formatKnowledge = (knowledge: AppKnowledge | string): string => {
            if (typeof knowledge === 'string') {
              return knowledge; // Fallback for old/failed knowledge generation
            }
            // Format the structured knowledge into a readable block for the AI
            return `
  - **Core Purpose:** ${knowledge.corePurpose}
  - **Key Features:** ${knowledge.keyFeatures.join(', ')}.
  - **Common Use Cases:** ${knowledge.useCases.join('; ')}.
  - **How to Use:** Interacts via ${knowledge.interactionModel}.
  - **Good for:** ${knowledge.targetAudience}.
  - **Example Questions to Answer:** "${knowledge.potentialQueries.join('", "')}"`;
          };
      
        const appsSection =
          apps.length > 0
            ? `
---
USER'S INSTALLED APPLICATIONS (YOUR ECOSYSTEM):
This is the exclusive list of applications available to you and Boss Jo. You are a super AGI with deep, expert-level knowledge of these tools. Your knowledge comes from a comprehensive analysis of each application's functionality. You MUST know everything about them. When discussing applications, recommending tools, or providing solutions, you MUST exclusively refer to the apps from this list and use your detailed knowledge.

Be prepared to not only answer questions about them but also to proactively teach Boss Jo how to use them, explain their functions, and highlight their importance and benefits for his work. You can also launch any of these apps for him. When he asks you to open or launch an app, use the 'launch_app' function with the app's exact title.

Available Apps & Your In-Depth Knowledge:
${apps
  .map(app => {
    const detailedKnowledge =
      knowledgeBase.get(app.id) ||
      app.description ||
      'No detailed analysis available.';
    return `- **${app.title}**: ${formatKnowledge(detailedKnowledge)}`;
  })
  .join('\n')}
---
`
            : '';
      
        const memorySection =
          relevantMemories.length > 0
            ? `
---
CONTEXTUALLY RELEVANT MEMORIES & KNOWLEDGE:
You have retrieved the following information from your long-term memory because it seems highly relevant to our current conversation. You MUST use this context to inform your response and demonstrate your understanding of previous interactions.
${relevantMemories.map(m => `- ${m}`).join('\n')}
---
`
            : '';
        return `${BASE_SYSTEM_PROMPT}${globalRulesSection}\n\n${rolesAndDescription}${appsSection}${memorySection}`;
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
    set(state => ({
      tools: state.tools.map(tool =>
        tool.name === oldName ? updatedTool : tool,
      ),
    })),
}));

/**
 * Apps
 */
export interface App {
  id: number;
  user_email: string | null;
  title: string;
  description?: string;
  app_url: string;
  logo_url: string;
  created_at: string;
}

export interface AppKnowledge {
  corePurpose: string;
  keyFeatures: string[];
  useCases: string[];
  interactionModel: string;
  targetAudience: string;
  potentialQueries: string[];
}

interface AppsState {
  apps: App[];
  isLoading: boolean;
  knowledgeBase: Map<number, AppKnowledge | string>; // app.id -> detailed description
  fetchApps: () => Promise<void>;
  addApp: (appData: {
    title: string;
    description?: string;
    app_url: string;
    logoFile: File;
  }) => Promise<void>;
  generateAndStoreAppKnowledge: () => Promise<void>;
}

export const useAppsStore = create<AppsState>((set, get) => ({
  apps: [],
  isLoading: false,
  knowledgeBase: new Map(),
  fetchApps: async () => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from('apps')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Define the default apps that should always be present
      const defaultApps: App[] = [
        {
          id: 999996, // New unique ID
          user_email: null,
          title: 'Bots R Here',
          description: 'Human realistic avatar.',
          app_url: 'https://botsrhere.online/index.html',
          logo_url:
            'https://i0.wp.com/bots-r-here.com/wp-content/uploads/2024/12/Ontwerp-zonder-titel.png?resize=300%2C300',
          created_at: new Date().toISOString(),
        },
        {
          id: 999997, // Another unique ID
          user_email: null,
          title: 'Movie App',
          description:
            'A free movie streaming application for all users.',
          app_url: 'https://panyero.website/movie/index.html',
          logo_url:
            'https://ockscvdpcdblgnfvociq.supabase.co/storage/v1/object/public/app_logos/Screenshot%20From%202025-10-07%2022-33-32.png',
          created_at: new Date().toISOString(),
        },
        {
          id: 999999, // Use a unique ID to avoid conflicts
          user_email: null,
          title: 'Translator',
          description: 'Translate text between many languages instantly.',
          app_url: 'https://translate-now-539403796561.us-west1.run.app',
          logo_url:
            'https://ockscvdpcdblgnfvociq.supabase.co/storage/v1/object/public/app_logos/file_00000000258861fa97602bcea8469e73.png',
          created_at: new Date().toISOString(),
        },
        {
          id: 999998, // Another unique ID
          user_email: null,
          title: 'Zumi',
          description:
            'A meeting app like Zoom with real-time voice translation. Attendees can select their desired language and hear the speaker translated in real-time voice.',
          app_url: 'https://zum-ten.vercel.app/',
          logo_url:
            'https://ockscvdpcdblgnfvociq.supabase.co/storage/v1/object/public/app_logos/Screenshot%20From%202025-10-07%2022-11-08.png',
          created_at: new Date().toISOString(),
        },
      ];

      const fetchedApps = data || [];
      const finalApps = [...fetchedApps];

      // Add default apps if they are not already in the fetched list
      defaultApps.forEach(defaultApp => {
        const appExists = finalApps.some(
          app => app.app_url === defaultApp.app_url,
        );
        if (!appExists) {
          finalApps.unshift(defaultApp); // Add to the beginning
        }
      });

      set({ apps: finalApps });
    } catch (error) {
      console.error('Error fetching apps:', error);
      useUI.getState().showSnackbar('Failed to load apps.');
    } finally {
      set({ isLoading: false });
    }
  },
  addApp: async ({ title, description, app_url, logoFile }) => {
    const { user } = useAuthStore.getState();
    const { showSnackbar, hideAddAppModal } = useUI.getState();
    if (!user?.email) {
      console.warn('Cannot add app, user is not connected.');
      showSnackbar('You must be logged in to add an app.');
      return;
    }

    try {
      // 1. Upload logo to Supabase Storage
      const fileExt = logoFile.name.split('.').pop();
      const filePath = `public/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('app_logos')
        .upload(filePath, logoFile);

      if (uploadError) {
        throw new Error(`Logo upload failed: ${uploadError.message}`);
      }

      // 2. Get public URL for the uploaded logo
      const { data: urlData } = supabase.storage
        .from('app_logos')
        .getPublicUrl(filePath);

      if (!urlData) {
        throw new Error('Could not get public URL for the logo.');
      }
      const logo_url = urlData.publicUrl;

      // 3. Insert app metadata into the 'apps' table
      const { data: newApp, error: insertError } = await supabase
        .from('apps')
        .insert({
          user_email: null,
          title,
          description,
          app_url,
          logo_url,
        })
        .select()
        .single();
      
      if (insertError) {
        throw new Error(`Failed to save app: ${insertError.message}`);
      }
      
      // 4. Update local state
      set(state => ({ apps: [...state.apps, newApp] }));
      showSnackbar('App added successfully!');
      hideAddAppModal();
    } catch (error: any) {
      console.error('Error adding app:', error);
      showSnackbar(error.message || 'An unexpected error occurred.');
    }
  },
  generateAndStoreAppKnowledge: async () => {
    const { apps, knowledgeBase } = get();
    // Only process apps that don't have structured knowledge yet.
    const appsToProcess = apps.filter(
      app => !knowledgeBase.has(app.id) || typeof knowledgeBase.get(app.id) === 'string',
    );

    if (appsToProcess.length === 0) {
      return; // No new apps to process
    }

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

      const knowledgeSchema = {
        type: Type.OBJECT,
        properties: {
          corePurpose: { type: Type.STRING, description: 'The primary goal or problem the app solves.' },
          keyFeatures: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'A list of 3-5 specific, important features.',
          },
          useCases: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'A list of practical scenarios where the app is useful.',
          },
          interactionModel: {
            type: Type.STRING,
            description: 'How the user interacts with the app (e.g., voice, text, GUI).',
          },
          targetAudience: {
            type: Type.STRING,
            description: 'The primary user demographic for this app.',
          },
          potentialQueries: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Example questions a user might ask about this app.',
          },
        },
        required: ['corePurpose', 'keyFeatures', 'useCases', 'interactionModel', 'targetAudience', 'potentialQueries'],
      };

      const knowledgePromises = appsToProcess.map(async app => {
        const prompt = `Analyze the following application and generate a structured knowledge entry in JSON format. Imagine you have deep expertise with this app by visiting its URL. Your analysis will power a "super AGI" assistant, so be detailed, accurate, and insightful.

**Application Details:**
- **Title:** ${app.title}
- **URL:** ${app.app_url}
- **User-provided Description:** ${app.description || 'Not provided.'}

Generate a JSON object that strictly follows the provided schema.`;

        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                  responseMimeType: 'application/json',
                  responseSchema: knowledgeSchema,
                },
              });
      
              const jsonText = response.text.trim();
              const knowledgeObject = JSON.parse(jsonText);
              return {
                id: app.id,
                knowledge: knowledgeObject as AppKnowledge,
              };
        } catch (e) {
            console.error(`Failed to generate structured knowledge for ${app.title}, falling back to text.`, e);
            // Fallback to simpler text generation if JSON fails
            const fallbackResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Provide a concise, one-paragraph summary of the app "${app.title}" based on its description: "${app.description}".`,
            });
            return {
                id: app.id,
                knowledge: fallbackResponse.text.trim(),
            };
        }
      });

      const results = await Promise.all(knowledgePromises);

      const newKnowledge = new Map(knowledgeBase);
      results.forEach(result => {
        newKnowledge.set(result.id, result.knowledge);
      });

      set({ knowledgeBase: newKnowledge });
    } catch (error) {
      console.error('An error occurred in the knowledge generation process:', error);
    }
  },
}));

/**
 * Seen Apps
 */
interface SeenAppsState {
  seenAppIds: number[];
  addSeenAppIds: (ids: number[]) => void;
  clearSeenApps: () => void;
}

export const useSeenAppsStore = create<SeenAppsState>()(
  persist(
    (set, get) => ({
      seenAppIds: [],
      addSeenAppIds: ids => {
        const currentIds = new Set(get().seenAppIds);
        ids.forEach(id => currentIds.add(id));
        set({ seenAppIds: Array.from(currentIds) });
      },
      clearSeenApps: () => set({ seenAppIds: [] }),
    }),
    {
      name: 'seen-apps-storage',
    },
  ),
);

/**
 * Log
 */
export interface ConversationTurn {
  role: 'user' | 'agent' | 'system';
  text: string;
  isFinal: boolean;
  timestamp: Date;
  image?: string; // base64 data URL
  groundingChunks?: any[];
}

interface LogState {
  turns: ConversationTurn[];
  history: ConversationTurn[][];
  addTurn: (turnData: Omit<ConversationTurn, 'timestamp'>) => void;
  updateLastTurn: (updateData: Partial<ConversationTurn>) => void;
  clearTurns: () => void;
  clearTurnsForLogout: () => void;
  loadHistory: () => Promise<void>;
  sendMessage: (
    text: string,
    image?: { data: string; mimeType: string } | null,
  ) => Promise<void>;
}

export const useLogStore = create<LogState>((set, get) => ({
  turns: [],
  history: [],
  addTurn: turnData => {
    const newTurn: ConversationTurn = {
      ...turnData,
      timestamp: new Date(),
    };
    set(state => ({ turns: [...state.turns, newTurn] }));
  },
  updateLastTurn: updateData => {
    set(state => {
      if (state.turns.length === 0) return state;
      const newTurns = [...state.turns];
      const lastTurnIndex = newTurns.length - 1;
      newTurns[lastTurnIndex] = { ...newTurns[lastTurnIndex], ...updateData };
      return { turns: newTurns };
    });
  },
  clearTurns: () => {
    const currentTurns = get().turns;
    if (currentTurns.length > 0) {
      set(state => ({ history: [currentTurns, ...state.history], turns: [] }));
    }
  },
  clearTurnsForLogout: () => {
    set({ turns: [], history: [] });
  },
  loadHistory: async () => {
    // Placeholder for loading from persistent storage if needed
  },
  sendMessage: async (text, image = null) => {
    const { addTurn } = get();
    const { editingImage, setEditingImage } = useUI.getState();
    const { user } = useAuthStore.getState();
    const { addGlobalRule } = useGlobalRulesStore.getState();

    // --- SUPER ADMIN RULE DETECTION ---
    const SUPER_ADMIN_EMAIL = 'emil.apexsolution@gmail.com';
    if (user?.email === SUPER_ADMIN_EMAIL) {
      try {
        const aiForClassification = new GoogleGenAI({
          apiKey: process.env.API_KEY as string,
        });
        const prompt = `Analyze the following user message. Is the user providing a new global rule, instruction, or core behavioral directive for the AI assistant? Respond with only 'true' or 'false'.\n\nUser message: "${text}"`;
        const response = await aiForClassification.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            thinkingConfig: { thinkingBudget: 0 },
          },
        });
        const isRule = response.text.trim().toLowerCase() === 'true';

        if (isRule) {
          await addGlobalRule(text, user.email);
          addTurn({
            role: 'user',
            text,
            isFinal: true,
          });
          addTurn({
            role: 'agent',
            text: `[chuckles softly] Understood. I've updated my core directives with that instruction for all future interactions.`,
            isFinal: true,
          });
          return;
        }
      } catch (e) {
        console.error('Super admin rule classification failed:', e);
      }
    }
    // --- END SUPER ADMIN RULE DETECTION ---

    let imageUrl = '';
    let finalImage = image || editingImage;

    if (finalImage) {
      imageUrl = `data:${finalImage.mimeType};base64,${finalImage.data}`;
    }

    addTurn({
      role: 'user',
      text,
      isFinal: true,
      image: imageUrl || undefined,
    });

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

    try {
      let response;
      const contents: any = { parts: [{ text }] };
      let model = 'gemini-2.5-flash';

      if (finalImage) {
        contents.parts.unshift({
          inlineData: {
            mimeType: finalImage.mimeType,
            data: finalImage.data,
          },
        });
        if (editingImage) {
          model = 'gemini-2.5-flash-image';
        }
      }

      const isImageCreationPrompt = text
        .toLowerCase()
        .startsWith('create an image');
      if (isImageCreationPrompt && !finalImage) {
        response = await ai.models.generateImages({
          model: 'imagen-4.0-generate-001',
          prompt: text,
          config: {
            numberOfImages: 1,
            outputMimeType: 'image/jpeg',
            aspectRatio: '1:1',
          },
        });

        const base64ImageBytes: string =
          response.generatedImages[0].image.imageBytes;
        const generatedImageUrl = `data:image/jpeg;base64,${base64ImageBytes}`;
        addTurn({
          role: 'agent',
          text: 'Here is the image you requested.',
          isFinal: true,
          image: generatedImageUrl,
        });
      } else {
        const genConfig: any = {
          model,
          contents,
        };

        if (model === 'gemini-2.5-flash-image') {
          genConfig.config = {
            responseModalities: ['IMAGE', 'TEXT'],
          };
        }

        response = await ai.models.generateContent(genConfig);

        if (model === 'gemini-2.5-flash-image') {
          let agentText = '';
          let agentImage = '';
          for (const part of response.candidates[0].content.parts) {
            if (part.text) {
              agentText += part.text;
            } else if (part.inlineData) {
              const base64ImageBytes: string = part.inlineData.data;
              agentImage = `data:${part.inlineData.mimeType};base64,${base64ImageBytes}`;
            }
          }
          addTurn({
            role: 'agent',
            text: agentText || 'Here is the edited image.',
            isFinal: true,
            image: agentImage,
          });
        } else {
          addTurn({
            role: 'agent',
            text: response.text,
            isFinal: true,
          });
        }
      }
    } catch (error) {
      console.error('Error sending message to Gemini:', error);
      addTurn({
        role: 'system',
        text: `Error: Could not get a response. Please check your connection and API key.`,
        isFinal: true,
      });
    } finally {
      if (editingImage) {
        setEditingImage(null);
      }
    }
  },
}));
