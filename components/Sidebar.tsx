/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {
  FunctionCall,
  useSettings,
  useUI,
  useTools,
  useUserSettings,
  useGoogleIntegrationStore,
  useSupabaseIntegrationStore,
  useWhatsAppIntegrationStore,
  useAuthStore,
} from '@/lib/state';
import c from 'classnames';
import { AVAILABLE_VOICES_MAP } from '@/lib/constants';
import { useLiveAPIContext } from '@/contexts/LiveAPIContext';
import { useState, useEffect } from 'react';
import ToolEditorModal from './ToolEditorModal';

export default function Sidebar() {
  const { isSidebarOpen, toggleSidebar, showWhatsAppModal } = useUI();
  const { tools, toggleTool, addTool, removeTool, updateTool } = useTools();
  const { connected } = useLiveAPIContext();
  const {
    personaName,
    rolesAndDescription,
    voice,
    setVoice,
    savePersona,
  } = useUserSettings();
  const { user, session, signOut, signInWithGoogle } = useAuthStore();
  const isGoogleConnected = !!session?.provider_token;

  const googleIntegration = useGoogleIntegrationStore();
  const supabaseIntegration = useSupabaseIntegrationStore();
  const whatsAppIntegration = useWhatsAppIntegrationStore();

  const [editingTool, setEditingTool] = useState<FunctionCall | null>(null);
  const [activeTab, setActiveTab] = useState('server');

  // Local state for persona editing
  const [localPersonaName, setLocalPersonaName] = useState(personaName);
  const [localRolesAndDescription, setLocalRolesAndDescription] =
    useState(rolesAndDescription);

  useEffect(() => {
    setLocalPersonaName(personaName);
  }, [personaName]);

  useEffect(() => {
    setLocalRolesAndDescription(rolesAndDescription);
  }, [rolesAndDescription]);

  const handleSaveTool = (updatedTool: FunctionCall) => {
    if (editingTool) {
      updateTool(editingTool.name, updatedTool);
    }
    setEditingTool(null);
  };

  const handleSavePersona = async () => {
    await savePersona(localPersonaName, localRolesAndDescription);
  };

  const hasPersonaChanges =
    localPersonaName !== personaName ||
    localRolesAndDescription !== rolesAndDescription;

  return (
    <>
      <aside className={c('sidebar', { open: isSidebarOpen })}>
        <div className="sidebar-header">
          <h3>Settings</h3>
          <button onClick={toggleSidebar} className="close-button">
            <span className="icon">close</span>
          </button>
        </div>

        <div className="sidebar-tabs">
          <button
            className={c('sidebar-tab', { active: activeTab === 'server' })}
            onClick={() => setActiveTab('server')}
            aria-controls="server-settings-panel"
            aria-selected={activeTab === 'server'}
            role="tab"
          >
            Server Settings
          </button>
          <button
            className={c('sidebar-tab', { active: activeTab === 'user' })}
            onClick={() => setActiveTab('user')}
            aria-controls="user-settings-panel"
            aria-selected={activeTab === 'user'}
            role="tab"
          >
            User Settings
          </button>
        </div>

        <div className="sidebar-content">
          {activeTab === 'server' && (
            <div
              id="server-settings-panel"
              className="tab-panel"
              role="tabpanel"
              aria-labelledby="server-settings-tab"
            >
              <div className="sidebar-section settings-card">
                <h4 className="sidebar-section-title">Branding</h4>
                <p className="description-text">
                  Customize your agent's appearance. Find icons at{' '}
                  <a
                    href="https://fonts.google.com/icons"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Google Fonts
                  </a>
                  .
                </p>
              </div>

              <div className="sidebar-section settings-card">
                <h4 className="sidebar-section-title">
                  Google OAuth Credentials
                </h4>
                <p className="description-text">
                  Configure credentials from your{' '}
                  <a
                    href="https://console.cloud.google.com/apis/credentials"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Google Cloud Console
                  </a>
                  .
                </p>
                <fieldset disabled={connected || googleIntegration.isConfigured}>
                  <label>
                    Client ID
                    <input
                      type="text"
                      placeholder="e.g., your-id.apps.googleusercontent.com"
                      value={googleIntegration.clientId}
                      onChange={e =>
                        googleIntegration.setClientId(e.target.value)
                      }
                      aria-invalid={!!googleIntegration.errors.clientId}
                    />
                    {googleIntegration.errors.clientId && (
                      <p className="validation-error">
                        {googleIntegration.errors.clientId}
                      </p>
                    )}
                  </label>
                  <label>
                    Client Secret
                    <input
                      type="password"
                      placeholder="Enter your client secret"
                      value={googleIntegration.clientSecret}
                      onChange={e =>
                        googleIntegration.setClientSecret(e.target.value)
                      }
                      aria-invalid={!!googleIntegration.errors.clientSecret}
                    />
                    {googleIntegration.errors.clientSecret && (
                      <p className="validation-error">
                        {googleIntegration.errors.clientSecret}
                      </p>
                    )}
                  </label>
                </fieldset>
                <div className="credential-actions">
                  {googleIntegration.isConfigured ? (
                    <div className="status-indicator configured">
                      <span className="icon">check_circle</span> Correctly
                      Configured
                    </div>
                  ) : (
                    <>
                      {googleIntegration.isValidated &&
                        !Object.keys(googleIntegration.errors).length && (
                          <p className="validation-success">
                            <span className="icon">check</span> All good. You
                            can Save.
                          </p>
                        )}
                      <div className="action-buttons">
                        <button
                          className="secondary-button"
                          onClick={googleIntegration.validateCredentials}
                          disabled={connected}
                        >
                          Check
                        </button>
                        <button
                          className="gradient-button"
                          onClick={googleIntegration.saveCredentials}
                          disabled={!googleIntegration.isValidated || connected}
                        >
                          Save
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="sidebar-section settings-card">
                <h4 className="sidebar-section-title">
                  Twilio Credentials for WhatsApp
                </h4>
                <p className="description-text">
                  Configure your credentials from your{' '}
                  <a
                    href="https://www.twilio.com/console"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Twilio Console
                  </a>
                  .
                </p>
                <fieldset
                  disabled={connected || whatsAppIntegration.isConfigured}
                >
                  <label>
                    Twilio Account SID
                    <input
                      type="text"
                      placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      value={whatsAppIntegration.accountSid}
                      onChange={e =>
                        whatsAppIntegration.setAccountSid(e.target.value)
                      }
                      aria-invalid={!!whatsAppIntegration.errors.accountSid}
                    />
                    {whatsAppIntegration.errors.accountSid && (
                      <p className="validation-error">
                        {whatsAppIntegration.errors.accountSid}
                      </p>
                    )}
                  </label>
                  <label>
                    Twilio Auth Token
                    <input
                      type="password"
                      placeholder="Enter your Twilio Auth Token"
                      value={whatsAppIntegration.authToken}
                      onChange={e =>
                        whatsAppIntegration.setAuthToken(e.target.value)
                      }
                      aria-invalid={!!whatsAppIntegration.errors.authToken}
                    />
                    {whatsAppIntegration.errors.authToken && (
                      <p className="validation-error">
                        {whatsAppIntegration.errors.authToken}
                      </p>
                    )}
                  </label>
                  <label>
                    Twilio Phone Number
                    <input
                      type="text"
                      placeholder="e.g., +15551234567"
                      value={whatsAppIntegration.twilioPhoneNumber}
                      onChange={e =>
                        whatsAppIntegration.setTwilioPhoneNumber(
                          e.target.value,
                        )
                      }
                      aria-invalid={
                        !!whatsAppIntegration.errors.twilioPhoneNumber
                      }
                    />
                    {whatsAppIntegration.errors.twilioPhoneNumber && (
                      <p className="validation-error">
                        {whatsAppIntegration.errors.twilioPhoneNumber}
                      </p>
                    )}
                  </label>
                </fieldset>
                <div className="credential-actions">
                  {whatsAppIntegration.isConfigured ? (
                    <div className="status-indicator configured">
                      <span className="icon">check_circle</span> Correctly
                      Configured
                    </div>
                  ) : (
                    <>
                      {whatsAppIntegration.isValidated &&
                        !Object.keys(whatsAppIntegration.errors).length && (
                          <p className="validation-success">
                            <span className="icon">check</span> All good. You
                            can Save.
                          </p>
                        )}
                      <div className="action-buttons">
                        <button
                          className="secondary-button"
                          onClick={whatsAppIntegration.validateCredentials}
                          disabled={connected}
                        >
                          Check
                        </button>
                        <button
                          className="gradient-button"
                          onClick={whatsAppIntegration.saveCredentials}
                          disabled={
                            !whatsAppIntegration.isValidated || connected
                          }
                        >
                          Save
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="sidebar-section settings-card">
                <h4 className="sidebar-section-title">Supabase Credentials</h4>
                <p className="description-text">
                  Supabase credentials have been pre-configured for this
                  application.
                </p>
                <div className="credential-actions">
                  <div className="status-indicator configured">
                    <span className="icon">check_circle</span> Correctly
                    Configured
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'user' && (
            <div
              id="user-settings-panel"
              className="tab-panel"
              role="tabpanel"
              aria-labelledby="user-settings-tab"
            >
              <div className="sidebar-section">
                 <h4 className="sidebar-section-title">Account</h4>
                 <div className="user-info-card">
                   <p>Signed in as</p>
                   <strong>{user?.email}</strong>
                   <button onClick={signOut} className="sign-out-button">
                      Sign Out
                   </button>
                 </div>
              </div>
              <div className="sidebar-section">
                <h4 className="sidebar-section-title">Persona</h4>
                <fieldset disabled={connected}>
                  <label>
                    Persona Name
                    <input
                      type="text"
                      value={localPersonaName}
                      onChange={e => setLocalPersonaName(e.target.value)}
                      placeholder="Give your assistant a name"
                    />
                  </label>
                  <label>
                    Roles and description
                    <textarea
                      value={localRolesAndDescription}
                      onChange={e =>
                        setLocalRolesAndDescription(e.target.value)
                      }
                      rows={6}
                      placeholder="Describe the role and personality of the AI..."
                    />
                  </label>
                  <label>
                    Voice
                    <select
                      value={voice}
                      onChange={e => setVoice(e.target.value)}
                    >
                      {AVAILABLE_VOICES_MAP.map(v => (
                        <option key={v.value} value={v.value}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </fieldset>
                <div className="persona-actions">
                  <button
                    className="gradient-button"
                    onClick={handleSavePersona}
                    disabled={!hasPersonaChanges || connected}
                  >
                    Save
                  </button>
                </div>
              </div>

              <div className="sidebar-section">
                <h4 className="sidebar-section-title">Integration Tools</h4>
                {googleIntegration.isConfigured ? (
                  <div className="integration-item">
                    <div className="integration-info">
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 18 18"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                      >
                        <path
                          d="M17.64 9.20455C17.64 8.56682 17.5827 7.95273 17.4764 7.36364H9V10.845H13.8436C13.635 11.97 13.0009 12.9232 12.0477 13.6127V15.7132H14.8323C16.6432 14.0777 17.64 11.8545 17.64 9.20455Z"
                          fill="#4285F4"
                        ></path>
                        <path
                          d="M9 18C11.43 18 13.4673 17.1941 14.8323 15.7132L12.0477 13.6127C11.2418 14.1277 10.2109 14.4205 9 14.4205C6.96273 14.4205 5.23091 13.0127 4.60636 11.1818H1.79591V13.3541C3.24273 16.09 5.86636 18 9 18Z"
                          fill="#34A853"
                        ></path>
                        <path
                          d="M4.60636 11.1818C4.41818 10.6368 4.32273 10.0595 4.32273 9.47045C4.32273 8.88136 4.41818 8.30409 4.60636 7.75909V5.58682H1.79591C1.22182 6.71182 0.899999 7.99091 0.899999 9.47045C0.899999 10.95 1.22182 12.2291 1.79591 13.3541L4.60636 11.1818Z"
                          fill="#FBBC05"
                        ></path>
                        <path
                          d="M9 4.52045C10.3214 4.52045 11.5077 4.99136 12.4827 5.90818L14.8936 3.49727C13.4673 2.18955 11.43 1.36364 9 1.36364C5.86636 1.36364 3.24273 3.91 1.79591 6.64591L4.60636 8.81818C5.23091 6.98727 6.96273 5.57955 9 5.57955V4.52045Z"
                          fill="#EA4335"
                        ></path>
                      </svg>
                      <strong>Google Services</strong>
                    </div>
                    {isGoogleConnected ? (
                      <div className="integration-connected">
                        <div className="status-indicator active">
                          <span className="status-dot"></span>
                          Active
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={signInWithGoogle}
                        className="connect-button google-connect"
                        disabled={connected}
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 18 18"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          aria-hidden="true"
                        >
                          <path
                            d="M17.64 9.20455C17.64 8.56682 17.5827 7.95273 17.4764 7.36364H9V10.845H13.8436C13.635 11.97 13.0009 12.9232 12.0477 13.6127V15.7132H14.8323C16.6432 14.0777 17.64 11.8545 17.64 9.20455Z"
                            fill="#4285F4"
                          ></path>
                          <path
                            d="M9 18C11.43 18 13.4673 17.1941 14.8323 15.7132L12.0477 13.6127C11.2418 14.1277 10.2109 14.4205 9 14.4205C6.96273 14.4205 5.23091 13.0127 4.60636 11.1818H1.79591V13.3541C3.24273 16.09 5.86636 18 9 18Z"
                            fill="#34A853"
                          ></path>
                          <path
                            d="M4.60636 11.1818C4.41818 10.6368 4.32273 10.0595 4.32273 9.47045C4.32273 8.88136 4.41818 8.30409 4.60636 7.75909V5.58682H1.79591C1.22182 6.71182 0.899999 7.99091 0.899999 9.47045C0.899999 10.95 1.22182 12.2291 1.79591 13.3541L4.60636 11.1818Z"
                            fill="#FBBC05"
                          ></path>
                          <path
                            d="M9 4.52045C10.3214 4.52045 11.5077 4.99136 12.4827 5.90818L14.8936 3.49727C13.4673 2.18955 11.43 1.36364 9 1.36364C5.86636 1.36364 3.24273 3.91 1.79591 6.64591L4.60636 8.81818C5.23091 6.98727 6.96273 5.57955 9 5.57955V4.52045Z"
                            fill="#EA4335"
                          ></path>
                        </svg>
                        Connect Google Account
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="integration-not-configured">
                    <p>Google integration not yet configured by admin.</p>
                  </div>
                )}
                 {whatsAppIntegration.isConfigured ? (
                  <div className="integration-item">
                    <div className="integration-info">
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          clipRule="evenodd"
                          d="M12 2C6.477 2 2 6.477 2 12C2 13.872 2.508 15.634 3.388 17.165L2.343 20.657C2.213 21.107 2.493 21.557 2.943 21.687C3.126 21.739 3.32 21.747 3.507 21.706L7.086 20.701C8.552 21.492 10.219 22 12 22C17.523 22 22 17.523 22 12C22 6.477 17.523 2 12 2ZM12 4C16.418 4 20 7.582 20 12C20 16.418 16.418 20 12 20C10.45 20 8.995 19.605 7.744 18.921L7.202 18.636L4.343 19.343L5.05 16.484L4.765 15.942C4.081 14.691 3.686 13.235 3.686 11.686C3.686 7.582 7.582 4 12 4ZM9.255 7.357C9.079 7.357 8.847 7.41 8.653 7.593C8.46 7.776 8.001 8.212 8.001 9.118C8.001 10.024 8.666 10.875 8.78 11.029C8.894 11.183 10.233 13.433 12.445 14.34C14.218 15.06 14.677 14.863 15.015 14.808C15.353 14.752 16.294 14.202 16.47 13.626C16.645 13.05 16.645 12.576 16.588 12.494C16.531 12.412 16.355 12.356 16.124 12.241C15.892 12.126 14.689 11.536 14.471 11.454C14.254 11.372 14.09 11.315 13.926 11.609C13.763 11.903 13.246 12.494 13.082 12.677C12.919 12.86 12.755 12.889 12.524 12.774C12.292 12.659 11.396 12.336 10.315 11.385C9.444 10.627 8.881 9.702 8.726 9.436C8.571 9.17 8.686 9.043 8.811 8.928C8.921 8.827 9.064 8.644 9.208 8.489C9.351 8.334 9.395 8.247 9.482 8.093C9.57 7.939 9.526 7.808 9.469 7.693C9.412 7.578 9.255 7.357 9.255 7.357Z"
                          fill="#25D366"
                        ></path>
                      </svg>
                      <strong>WhatsApp</strong>
                    </div>
                    {whatsAppIntegration.isUserConnected ? (
                      <div className="integration-connected">
                        <div className="status-indicator active">
                          <span className="status-dot"></span>
                          Active
                        </div>
                        <button
                          onClick={whatsAppIntegration.disconnectUser}
                          className="disconnect-button"
                        >
                          Disconnect
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={showWhatsAppModal}
                        className="connect-button whatsapp-connect"
                      >
                        Connect WhatsApp
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="integration-not-configured">
                    <p>WhatsApp integration not yet configured by admin.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </aside>
      {editingTool && (
        <ToolEditorModal
          tool={editingTool}
          onClose={() => setEditingTool(null)}
          onSave={handleSaveTool}
        />
      )}
    </>
  );
}