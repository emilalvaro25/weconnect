/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { useUI } from '../lib/state';

export default function AppViewer() {
  const { viewingAppUrl, setViewingAppUrl } = useUI();

  if (!viewingAppUrl) {
    return null;
  }

  return (
    <div className="app-viewer-overlay">
      <div className="app-viewer-header">
        <button
          className="icon-button"
          onClick={() => setViewingAppUrl(null)}
          aria-label="Close app viewer"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
      <iframe
        src={viewingAppUrl}
        className="app-viewer-iframe"
        title="App Viewer"
        allow="camera; microphone; autoplay; display-capture; fullscreen; clipboard-write; clipboard-read; speaker-selection;"
      />
    </div>
  );
}