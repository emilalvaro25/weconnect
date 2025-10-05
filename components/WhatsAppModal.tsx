/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// Fix: Import React to provide the 'React' namespace for types like React.KeyboardEvent.
import React, { useState } from 'react';
import Modal from './Modal';
import { useUI, useWhatsAppIntegrationStore } from '@/lib/state';

// Simple placeholder QR code SVG
const QrCodePlaceholder = () => (
  <svg width="200" height="200" viewBox="0 0 25 25" xmlns="http://www.w3.org/2000/svg" fill="#000">
    <path d="M0 0h7v7H0V0Zm2 2v3h3V2H2Z" />
    <path d="M9 0h2v5H9V0Zm2 2h2v3h-2V2Zm-2 3h2v2H9V5Zm-2 2h2v2H7V7Zm2 0h2v2H9V7Zm0 2h2v2H9V9Zm2-2h2v2h-2V7Zm0 2h2v2h-2V9Zm2-2h2v2h-2V7Zm0 2h2v2h-2V9Zm-4 4h2v2H9v-2Zm2-2h2v2h-2V9Zm2 0h2v2h-2V9Zm-2 2h2v2h-2v-2Zm-2 0h2v2H9v-2Zm-2 2h2v2H7v-2Zm0-2h2v2H7V9Zm2 2h2v2H9v-2Z" />
    <path d="M18 0h7v7h-7V0Zm2 2v3h3V2h-3Z" />
    <path d="M0 18h7v7H0v-7Zm2 2v3h3v-3H2Z" />
    <path d="M18 11h2v2h-2v-2Zm2 0h2v2h-2v-2Zm-2 2h2v2h-2v-2Zm-2 2h2v2h-2v-2Zm0-2h2v2h-2v-2Zm2 2h2v2h-2v-2Zm2 0h2v2h-2v-2Zm0 2h2v2h-2v-2Zm-2 2h2v2h-2v-2Zm-2 0h2v2h-2v-2Zm0 2h2v2h-2v-2Zm-2 0h2v2h-2v-2Z" />
    <path d="M9 18h2v2H9v-2Zm-2 2h2v2H7v-2Zm2 0h2v2H9v-2Zm-2 2h2v2H7v-2Zm4 0h2v2h-2v-2Zm2-2h2v2h-2v-2Zm0-2h2v2h-2v-2Z" />
  </svg>
);


export default function WhatsAppModal() {
  const { hideWhatsAppModal, showSnackbar } = useUI();
  const { connectUser } = useWhatsAppIntegrationStore();
  const [phoneNumber, setPhoneNumber] = useState('');

  const handleConnect = () => {
    if (!phoneNumber.trim()) {
      alert('Please enter a phone number.');
      return;
    }
    // Simple validation (can be improved)
    if (!/^\+?[1-9]\d{1,14}$/.test(phoneNumber.replace(/\s+/g, ''))) {
       alert('Please enter a valid phone number with country code.');
       return
    }
    
    connectUser(phoneNumber);
    showSnackbar('WhatsApp connected successfully!');
    hideWhatsAppModal();
  };
  
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleConnect();
    }
  };

  return (
    <Modal onClose={hideWhatsAppModal}>
      <div className="whatsapp-modal-content">
        <h2>Connect your WhatsApp</h2>
        <p>Scan this QR code with your phone to start a conversation.</p>
        <div className="whatsapp-qr-code">
          <QrCodePlaceholder />
        </div>
        <div className="whatsapp-divider">OR</div>
        <div className="whatsapp-manual-entry">
          <label htmlFor="whatsapp-phone-number">Enter your number manually</label>
          <input
            id="whatsapp-phone-number"
            type="tel"
            placeholder="+1 (555) 123-4567"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div className="whatsapp-modal-actions">
          <button onClick={hideWhatsAppModal} className="cancel-button">
            Cancel
          </button>
          <button onClick={handleConnect} className="connect-button" disabled={!phoneNumber.trim()}>
            Connect
          </button>
        </div>
      </div>
    </Modal>
  );
}
