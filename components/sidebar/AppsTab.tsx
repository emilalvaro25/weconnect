/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect } from 'react';
import { useAppsStore } from '../../lib/state';
import AppCard from './AppCard';

export default function AppsTab() {
  const { apps, isLoading } = useAppsStore();

  return (
    <div className="apps-tab-panel">
      <div className="apps-tab-header">
        <h4 className="sidebar-section-title">My Apps</h4>
      </div>
      {isLoading && <p>Loading apps...</p>}
      {!isLoading && apps.length === 0 && (
        <div className="empty-state-message">
          <span className="material-symbols-outlined">apps</span>
          <p>No apps added yet.</p>
          <p>Click the '+' icon above to add your first app.</p>
        </div>
      )}
      <div className="app-card-list">
        {apps.map(app => (
          <React.Fragment key={app.id}>
            <AppCard app={app} />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
