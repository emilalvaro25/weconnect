/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import './WelcomeScreen.css';
import { useLogStore } from '@/lib/state';

const WelcomeScreen: React.FC = () => {
  const { sendMessage } = useLogStore();

  const handleChipClick = (prompt: string) => {
    sendMessage(prompt);
  };

  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        <h2 className="welcome-title">What can I help with?</h2>
        <div className="suggestion-chips">
          <button
            className="chip chip-image"
            onClick={() =>
              handleChipClick('Create an image of a futuristic city at sunset')
            }
          >
            <span className="material-symbols-outlined">palette</span>
            Create image
          </button>
          <button
            className="chip chip-drive"
            onClick={() =>
              handleChipClick('List my recent files in Google Drive')
            }
          >
            <span className="material-symbols-outlined">folder_open</span>
            List recent files
          </button>
          <button
            className="chip chip-calendar"
            onClick={() =>
              handleChipClick("What's on my calendar for today?")
            }
          >
            <span className="material-symbols-outlined">calendar_month</span>
            Check my calendar
          </button>
          <button
            className="chip chip-sheets"
            onClick={() =>
              handleChipClick(
                'Read the first 5 rows from my "Q3 Report" spreadsheet',
              )
            }
          >
            <span className="material-symbols-outlined">table_chart</span>
            Read a spreadsheet
          </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
