/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import Modal from './Modal';
import { useUI, useAppsStore } from '../lib/state';
import { LOGO_PACKET } from '../lib/logo-packet';
import cn from 'classnames';

export default function AddAppModal() {
  const { hideAddAppModal, showSnackbar } = useUI();
  const { addApp } = useAppsStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [appUrl, setAppUrl] = useState('');
  const [selectedLogoUrl, setSelectedLogoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !appUrl || !selectedLogoUrl) {
      showSnackbar('Title, URL, and a selected Logo are required.');
      return;
    }
    setIsLoading(true);

    try {
      // Fetch the selected logo and convert it to a File object
      const response = await fetch(selectedLogoUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch the selected logo.');
      }
      const blob = await response.blob();
      // Try to get a sensible filename from the URL
      const filename =
        selectedLogoUrl.split('/').pop()?.split('?')[0] || 'logo.svg';
      const logoFile = new File([blob], filename, { type: blob.type });

      await addApp({ title, description, app_url: appUrl, logoFile });
    } catch (error) {
      console.error('Error processing logo for upload:', error);
      showSnackbar(
        'There was an error preparing the logo. Please try again.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal onClose={hideAddAppModal}>
      <div className="add-app-modal">
        <h2>Add New App</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="app-title">Title</label>
            <input
              id="app-title"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="My Awesome App"
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="app-description">Description</label>
            <textarea
              id="app-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="A short description of the app"
            />
          </div>
          <div className="form-field">
            <label htmlFor="app-url">App URL</label>
            <input
              id="app-url"
              type="url"
              value={appUrl}
              onChange={e => setAppUrl(e.target.value)}
              placeholder="https://example.com"
              required
            />
          </div>
          <div className="form-field">
            <label>Choose a Logo</label>
            <div className="logo-selection-grid">
              {LOGO_PACKET.map(url => (
                <div
                  key={url}
                  className={cn('logo-option', {
                    selected: selectedLogoUrl === url,
                  })}
                  onClick={() => setSelectedLogoUrl(url)}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selectedLogoUrl === url}
                >
                  <img src={url} alt="App logo option" />
                </div>
              ))}
            </div>
          </div>
          <div className="modal-actions">
            <button
              type="button"
              onClick={hideAddAppModal}
              className="cancel-button"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="save-button"
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : 'Save App'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}