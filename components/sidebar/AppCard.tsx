/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { App, useAuthStore, useUI } from '../../lib/state';

interface AppCardProps {
  app: App;
}

export default function AppCard({ app }: AppCardProps) {
  const { setViewingAppUrl } = useUI();
  const { session } = useAuthStore();

  const handleLaunch = () => {
    let url = app.app_url;
    if (app.title === 'Zumi' && session?.access_token) {
      try {
        const urlObject = new URL(url);
        urlObject.searchParams.set('auth_token', session.access_token);
        url = urlObject.toString();
      } catch (e) {
        console.error('Invalid app URL for Zumi:', app.app_url);
      }
    }
    setViewingAppUrl(url);
  };

  return (
    <div
      className="app-card"
      onClick={handleLaunch}
      role="button"
      tabIndex={0}
    >
      <img
        src={app.logo_url}
        alt={`${app.title} logo`}
        className="app-card-logo"
      />
      <div className="app-card-content">
        <h5 className="app-card-title">{app.title}</h5>
        <p className="app-card-description">{app.description}</p>
      </div>
    </div>
  );
}
