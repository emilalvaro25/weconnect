/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { App, useUI } from '../../lib/state';

interface AppCardProps {
  app: App;
}

export default function AppCard({ app }: AppCardProps) {
  const { setViewingAppUrl } = useUI();

  return (
    <div className="app-card" onClick={() => setViewingAppUrl(app.app_url)} role="button" tabIndex={0}>
      <img src={app.logo_url} alt={`${app.title} logo`} className="app-card-logo" />
      <div className="app-card-content">
        <h5 className="app-card-title">{app.title}</h5>
        <p className="app-card-description">{app.description}</p>
      </div>
    </div>
  );
}
