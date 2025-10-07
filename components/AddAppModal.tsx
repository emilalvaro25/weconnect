/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useRef } from 'react';
import Modal from './Modal';
import { useUI, useAppsStore } from '../lib/state';

export default function AddAppModal() {
  const { hideAddAppModal } = useUI();
  const { addApp } = useAppsStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [appUrl, setAppUrl] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !appUrl || !logoFile) {
        useUI.getState().showSnackbar("Title, URL, and Logo are required.");
        return;
    }
    setIsLoading(true);
    await addApp({ title, description, app_url: appUrl, logoFile });
    setIsLoading(false);
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
             <label htmlFor="app-logo">Logo</label>
             <input
                id="app-logo"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                ref={fileInputRef}
                style={{ display: 'none' }}
                required
             />
             <button type="button" className="logo-upload-button" onClick={() => fileInputRef.current?.click()}>
                {logoPreview ? <img src={logoPreview} alt="Logo preview"/> : <span>Select Logo</span>}
             </button>
          </div>
          <div className="modal-actions">
            <button type="button" onClick={hideAddAppModal} className="cancel-button">
              Cancel
            </button>
            <button type="submit" className="save-button" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save App'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
