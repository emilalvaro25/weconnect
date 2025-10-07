/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import { useAuthStore } from '../lib/state';

const Auth = () => {
  type AuthView = 'login' | 'signup' | 'forgot_password';
  const [view, setView] = useState<AuthView>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    signInWithGoogle,
    signInWithPassword,
    signUpWithEmail,
    resetPassword,
  } = useAuthStore();

  const handleAuthAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      let response;
      if (view === 'login') {
        response = await signInWithPassword(email, password);
      } else {
        response = await signUpWithEmail(email, password);
      }
      if (response?.error) {
        throw response.error;
      } else if (view === 'signup' && response?.data.user && !response.data.session) {
        setMessage('Confirmation email sent. Please check your inbox.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { error } = await resetPassword(email);
      if (error) {
        throw error;
      }
      setMessage('Password reset instructions have been sent to your email.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderForm = () => {
    if (view === 'forgot_password') {
      return (
        <form onSubmit={handlePasswordReset} className="auth-form">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            aria-label="Email Address"
          />
          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? 'Sending...' : 'Send Reset Instructions'}
          </button>
        </form>
      );
    }

    return (
      <form onSubmit={handleAuthAction} className="auth-form">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          aria-label="Email Address"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          aria-label="Password"
        />
        <button type="submit" className="auth-button" disabled={loading}>
          {loading ? 'Processing...' : view === 'login' ? 'Sign In' : 'Sign Up'}
        </button>
      </form>
    );
  };

  const clearMessages = () => {
    setError(null);
    setMessage(null);
  };

  return (
    <div className="auth-container">
      <div className="auth-form-wrapper">
        <img
          src="https://ockscvdpcdblgnfvociq.supabase.co/storage/v1/object/public/app_logos/kithai.png"
          alt="Kithai AI Logo"
          className="auth-logo"
        />
        <h1 className="auth-title">Kithai AI</h1>
        <p className="auth-subtitle">
          {view === 'login' && 'Welcome back'}
          {view === 'signup' && 'Create your account'}
          {view === 'forgot_password' && 'Reset your password'}
        </p>

        {view !== 'forgot_password' && (
          <div className="auth-tabs">
            <button
              className={view === 'login' ? 'active' : ''}
              onClick={() => {
                setView('login');
                clearMessages();
              }}
            >
              Sign In
            </button>
            <button
              className={view === 'signup' ? 'active' : ''}
              onClick={() => {
                setView('signup');
                clearMessages();
              }}
            >
              Sign Up
            </button>
          </div>
        )}

        {renderForm()}

        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="auth-message" role="alert">
            {message}
          </p>
        )}

        {view === 'login' && (
          <button
            onClick={() => {
              setView('forgot_password');
              clearMessages();
            }}
            className="forgot-password-button"
          >
            Forgot your password?
          </button>
        )}

        {view === 'forgot_password' && (
          <button
            onClick={() => {
              setView('login');
              clearMessages();
            }}
            className="forgot-password-button"
          >
            Back to Sign In
          </button>
        )}

        {view !== 'forgot_password' && (
          <>
            <div className="auth-divider">
              <span>OR</span>
            </div>

            <button
              className="google-signin-button"
              onClick={signInWithGoogle}
              disabled={loading}
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
              Continue with Google
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default Auth;