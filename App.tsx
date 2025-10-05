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

import React, { useEffect } from 'react';
import ControlTray from './components/console/control-tray/ControlTray';
import ErrorScreen from './components/demo/ErrorScreen';
import StreamingConsole from './components/demo/streaming-console/StreamingConsole';
import VoiceCall from './components/demo/VoiceCall';
import cn from 'classnames';

import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Auth from './components/Auth';
import { LiveAPIProvider } from './contexts/LiveAPIContext';
import { useUI, useUserSettings, useAuthStore } from './lib/state';
import Snackbar from './components/Snackbar';
import WhatsAppModal from './components/WhatsAppModal';
import { supabase } from './lib/supabase';

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
  const { isVoiceCallActive, isWhatsAppModalOpen } = useUI();
  const { session, loading, setSession } = useAuthStore();
  const { loadUserData, resetToDefaults } = useUserSettings();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user?.email) {
        loadUserData(session.user.email);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user?.email) {
        loadUserData(session.user.email);
      } else {
        // User logged out, reset settings
        resetToDefaults();
      }
    });

    return () => subscription.unsubscribe();
  }, [setSession, loadUserData, resetToDefaults]);

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
        <div className={cn('main-ui-wrapper', { 'hidden': isVoiceCallActive })}>
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
