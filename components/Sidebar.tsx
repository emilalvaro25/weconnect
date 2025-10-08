/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {
  FunctionCall,
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
import AppsTab from './sidebar/AppsTab';

export default function Sidebar() {
  const { isSidebarOpen, toggleSidebar } = useUI();
  const { tools, updateTool } = useTools();
  const { connected } = useLiveAPIContext();
  const {
    personaName,
    rolesAndDescription,
    voice,
    setVoice,
    savePersona,
  } = useUserSettings();
  const { user, session, signOut } = useAuthStore();

  const googleIntegration = useGoogleIntegrationStore();
  const whatsAppIntegration = useWhatsAppIntegrationStore();

  const [editingTool, setEditingTool] = useState<FunctionCall | null>(null);
  const [activeTab, setActiveTab] = useState('persona');

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
          <div className="sidebar-header-actions">
            <button
              onClick={signOut}
              className="icon-button"
              aria-label="Sign out"
            >
              <span className="material-symbols-outlined">logout</span>
            </button>
            <button
              onClick={toggleSidebar}
              className="icon-button"
              aria-label="Close settings"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        <div className="sidebar-tabs">
          <button
            className={c('sidebar-tab', { active: activeTab === 'persona' })}
            onClick={() => setActiveTab('persona')}
            aria-controls="persona-panel"
            aria-selected={activeTab === 'persona'}
            role="tab"
          >
            Persona
          </button>
          <button
            className={c('sidebar-tab', { active: activeTab === 'apps' })}
            onClick={() => setActiveTab('apps')}
            aria-controls="apps-panel"
            aria-selected={activeTab === 'apps'}
            role="tab"
          >
            Apps
          </button>
          <button
            className={c('sidebar-tab', {
              active: activeTab === 'integrations',
            })}
            onClick={() => setActiveTab('integrations')}
            aria-controls="integrations-panel"
            aria-selected={activeTab === 'integrations'}
            role="tab"
          >
            Integrations
          </button>
        </div>

        <div className="sidebar-content">
          {activeTab === 'persona' && (
            <div
              id="persona-panel"
              className="tab-panel"
              role="tabpanel"
              aria-labelledby="persona-tab"
            >
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
                      rows={10}
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
                    <p className="description-text" style={{ marginTop: '0' }}>
                      The new voice will be applied on your next call.
                    </p>
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
            </div>
          )}
          {activeTab === 'apps' && (
            <div
              id="apps-panel"
              className="tab-panel"
              role="tabpanel"
              aria-labelledby="apps-tab"
            >
              <AppsTab />
            </div>
          )}
          {activeTab === 'integrations' && (
            <div
              id="integrations-panel"
              className="tab-panel"
              role="tabpanel"
              aria-labelledby="integrations-tab"
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
                    <div className="configured-container">
                      <div className="status-indicator configured">
                        <span className="icon">check_circle</span> Configured
                      </div>
                      <button
                        className="secondary-button edit-button"
                        onClick={googleIntegration.editCredentials}
                        disabled={connected}
                      >
                        Edit
                      </button>
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
                    <div className="configured-container">
                      <div className="status-indicator configured">
                        <span className="icon">check_circle</span> Configured
                      </div>
                      <button
                        className="secondary-button edit-button"
                        onClick={whatsAppIntegration.editCredentials}
                        disabled={connected}
                      >
                        Edit
                      </button>
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
                    <span className="icon">check_circle</span> Configured
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="sidebar-footer">
          <div className="user-info-card">
            <p>Signed in as</p>
            <strong>{user?.email}</strong>
          </div>
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