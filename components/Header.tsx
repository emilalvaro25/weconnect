/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useLogStore, useUI } from '@/lib/state';

export default function Header() {
  const { toggleSidebar } = useUI();
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
      <button
        className="icon-button"
        aria-label="Clear chat"
        onClick={clearTurns}
      >
        <span className="material-symbols-outlined">refresh</span>
      </button>
    </header>
  );
}