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

import React, { useEffect, useState } from 'react';
import ControlTray from './components/console/control-tray/ControlTray';
import ErrorScreen from './components/demo/ErrorScreen';
import StreamingConsole from './components/demo/streaming-console/StreamingConsole';
import VoiceCall from './components/demo/VoiceCall';
import cn from 'classnames';

import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Auth from './components/Auth';
import { LiveAPIProvider } from './contexts/LiveAPIContext';
import {
  useUI,
  useUserSettings,
  useAuthStore,
  useLogStore,
  useAppsStore,
  useSeenAppsStore,
  useGlobalRulesStore,
  useTools,
  useWhatsAppIntegrationStore,
} from './lib/state';
import Snackbar from './components/Snackbar';
import WhatsAppModal from './components/WhatsAppModal';
import { supabase } from './lib/supabase';
import AddAppModal from './components/AddAppModal';
import AppViewer from './components/AppViewer';
import SplashScreen from './components/SplashScreen';
import { GoogleGenAI } from '@google/genai';

// Fix: Use process.env.API_KEY per coding guidelines.
const API_KEY = process.env.API_KEY as string;
if (typeof API_KEY !== 'string') {
  throw new Error('Missing required environment variable: API_KEY');
}

/**
 * Main application component that provides a streaming interface for Live API.
 * Manages video streaming state and provides controls for webcam/screen capture.
 */
function App() {
  const [showSplash, setShowSplash] = useState(true);
  const { isVoiceCallActive, isWhatsAppModalOpen, isAddAppModalOpen } = useUI();
  const { session, loading, setSession } = useAuthStore();
  const {
    loadUserData,
    resetToDefaults,
    getSystemPrompt,
    seedInitialKnowledge,
    findAndUpdateRelevantMemories,
  } = useUserSettings();
  const {
    loadHistory,
    clearTurnsForLogout,
    turns,
    addTurn,
  } = useLogStore();
  const {
    apps,
    fetchApps,
    generateAndStoreAppKnowledge,
    clearAppsForLogout,
  } = useAppsStore();
  const { seenAppIds, addSeenAppIds, clearSeenApps } = useSeenAppsStore();
  const { fetchGlobalRules } = useGlobalRulesStore();
  const { resetTools } = useTools();
  const { clearUserConnection } = useWhatsAppIntegrationStore();

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user?.email) {
        await loadUserData(session.user.email);
        seedInitialKnowledge();
        loadHistory();
        fetchApps();
        fetchGlobalRules();
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user?.email) {
        await loadUserData(session.user.email);
        seedInitialKnowledge();
        loadHistory();
        fetchApps();
        fetchGlobalRules();
      } else {
        // User logged out, reset settings
        resetToDefaults();
        clearTurnsForLogout();
        clearSeenApps();
        clearAppsForLogout();
        resetTools();
        clearUserConnection();
      }
    });

    return () => subscription.unsubscribe();
  }, [
    setSession,
    loadUserData,
    resetToDefaults,
    loadHistory,
    clearTurnsForLogout,
    fetchApps,
    clearSeenApps,
    seedInitialKnowledge,
    fetchGlobalRules,
    clearAppsForLogout,
    resetTools,
    clearUserConnection,
  ]);

  useEffect(() => {
    if (apps.length > 0) {
      generateAndStoreAppKnowledge();
    }
  }, [apps, generateAndStoreAppKnowledge]);

  useEffect(() => {
    // This effect runs to check for and introduce new apps.
    const checkForNewApps = async () => {
      // Only run if apps are loaded, this is a new session, and we are not already processing.
      if (apps.length > 0 && turns.length === 0) {
        const newApps = apps.filter(app => !seenAppIds.includes(app.id));

        if (newApps.length > 0) {
          // There are new apps to announce.
          const ai = new GoogleGenAI({ apiKey: API_KEY });

          const personaDesc = useUserSettings.getState().rolesAndDescription;
          const match = personaDesc.match(/assistant of ([^,]+),/);
          const userName = match ? match[1] : 'your boss';

          const prompt = `You are Beatrice, the AI assistant. Upon starting a new session, you've noticed that new applications have been added to your system. Your task is to craft a warm, welcoming message for ${userName}. Start by greeting them personally. Then, announce that you have some new tools to show them. For each new app, introduce it by name and conversationally explain its key features and benefits in an engaging way.

Here are the new apps you need to introduce:

${JSON.stringify(newApps.map(app => ({ title: app.title, description: app.description })), null, 2)}
`;
          try {
            const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: prompt,
              config: {
                systemInstruction: getSystemPrompt(), // Use the main system prompt for consistency
              },
            });

            const introMessage = response.text;

            if (introMessage) {
              addTurn({
                role: 'agent',
                text: introMessage,
                isFinal: true,
              });
            }

            // Mark these apps as seen on success
            addSeenAppIds(newApps.map(app => app.id));
          } catch (error: any) {
            console.error('Failed to generate new app introduction:', error);
            if (error.message && error.message.includes('RESOURCE_EXHAUSTED')) {
              useUI
                .getState()
                .showSnackbar(
                  'Could not generate welcome message due to API limits.',
                );
            }
            // Also mark as seen on failure to prevent retrying on every app load
            addSeenAppIds(newApps.map(app => app.id));
          }
        }
      }
    };

    checkForNewApps();
  }, [apps, turns.length, seenAppIds, addSeenAppIds, addTurn, getSystemPrompt]);

  // Effect to trigger relevant memory search on new user input.
  useEffect(() => {
    // FIX: Property 'at' does not exist on type 'ConversationTurn[]'. Replaced with array index access.
    const lastTurn = turns[turns.length - 1];
    if (lastTurn && lastTurn.role === 'user' && lastTurn.isFinal) {
      findAndUpdateRelevantMemories(lastTurn.text);
    }
  }, [turns, findAndUpdateRelevantMemories]);

  if (showSplash) {
    return <SplashScreen />;
  }

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          background: '#000',
          color: '#fff',
          fontFamily: 'sans-serif',
        }}
      >
        <p>Loading...</p>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <div className="App">
      <LiveAPIProvider apiKey={API_KEY}>
        <ErrorScreen />
        {/* VoiceCall is always rendered to preserve its state (and the connection)
            even when not visible. Visibility is controlled by CSS. */}
        <VoiceCall />
        {isWhatsAppModalOpen && <WhatsAppModal />}
        {isAddAppModalOpen && <AddAppModal />}
        <AppViewer />
        <div
          className={cn('main-ui-wrapper', {
            hidden: isVoiceCallActive,
          })}
        >
          <Header />
          <Sidebar />
          <div className="main-container">
            <main>
              <StreamingConsole />
              <ControlTray />
            </main>
          </div>
        </div>
        <Snackbar />
      </LiveAPIProvider>
    </div>
  );
}

export default App;