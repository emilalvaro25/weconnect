/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useRef } from 'react';
import Modal from './Modal';
import { useUI, useAppsStore } from '../lib/state';
import { GoogleGenAI } from '@google/genai';

// Utility function to convert a base64 string (from API) to a File object
function base64StringToFile(
  base64String: string,
  filename: string,
  mimeType: string,
): File {
  const byteCharacters = atob(base64String);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });
  return new File([blob], filename, { type: mimeType });
}

export default function AddAppModal() {
  const { hideAddAppModal, showSnackbar } = useUI();
  const { addApp } = useAppsStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [appUrl, setAppUrl] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingLogo, setIsGeneratingLogo] = useState(false);
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

  const handleGenerateLogo = async () => {
    setIsGeneratingLogo(true);
    showSnackbar('Generating logo...');

    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      showSnackbar('API_KEY is not configured.');
      setIsGeneratingLogo(false);
      return;
    }
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `A simple, modern, flat vector icon logo for an app named "${title}". The app's purpose is: "${description}". The logo should be visually appealing, clean, and suitable for an app icon. White background.`;

    try {
      const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/png',
          aspectRatio: '1:1',
        },
      });

      const base64ImageBytes = response.generatedImages[0].image.imageBytes;
      const mimeType = 'image/png';
      const imageUrl = `data:${mimeType};base64,${base64ImageBytes}`;

      setLogoPreview(imageUrl);

      const generatedFile = base64StringToFile(
        base64ImageBytes,
        `${title || 'logo'}_logo.png`,
        mimeType,
      );
      setLogoFile(generatedFile);

      showSnackbar('Logo generated successfully!');
    } catch (error) {
      console.error('Error generating logo:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred.';
      showSnackbar(`Error generating logo: ${errorMessage}`);
    } finally {
      setIsGeneratingLogo(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !appUrl || !logoFile) {
      showSnackbar('Title, URL, and Logo are required.');
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
            <div className="logo-input-container">
              <input
                id="app-logo"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                ref={fileInputRef}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                className="logo-upload-button"
                onClick={() => fileInputRef.current?.click()}
              >
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo preview" />
                ) : (
                  <span>Select Logo</span>
                )}
              </button>
              <button
                type="button"
                className="generate-logo-button"
                onClick={handleGenerateLogo}
                disabled={(!title && !description) || isGeneratingLogo}
              >
                {isGeneratingLogo ? (
                  'Generating...'
                ) : (
                  <>
                    Generate with AI
                    <span className="material-symbols-outlined">
                      auto_awesome
                    </span>
                  </>
                )}
              </button>
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
              disabled={isLoading || isGeneratingLogo}
            >
              {isLoading ? 'Saving...' : 'Save App'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}