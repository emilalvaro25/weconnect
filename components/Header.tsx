/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useLogStore, useUI } from '@/lib/state';

export default function Header() {
  const { toggleSidebar, showAddAppModal } = useUI();
  const { clearTurns } = useLogStore();

  return (
    <header className="app-header">
      <button
        className="icon-button"
        onClick={toggleSidebar}
        aria-label="Menu"
      >
        <span className="material-symbols-outlined">menu</span>
      </button>
      <h1 className="app-title">Kithai AI</h1>
      <div className="header-actions">
        <button
          className="icon-button"
          aria-label="Add new app"
          onClick={showAddAppModal}
        >
          <span className="material-symbols-outlined">add</span>
        </button>
        <button
          className="icon-button"
          aria-label="New chat"
          onClick={clearTurns}
        >
          <span className="material-symbols-outlined">refresh</span>
        </button>
      </div>
    </header>
  );
}
