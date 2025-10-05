/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import { useAuthStore } from '../lib/state';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { signInWithGoogle, signInWithPassword, signUpWithEmail } = useAuthStore();

  const handleAuthAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      let response;
      if (isLogin) {
        response = await signInWithPassword(email, password);
      } else {
        response = await signUpWithEmail(email, password);
      }
      if (response?.error) {
        throw response.error;
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-form-wrapper">
        <h1 className="auth-title">Kithai AI</h1>
        <p className="auth-subtitle">
          {isLogin ? 'Welcome back' : 'Create your account'}
        </p>

        <div className="auth-tabs">
          <button
            className={isLogin ? 'active' : ''}
            onClick={() => {
              setIsLogin(true);
              setError(null);
            }}
          >
            Sign In
          </button>
          <button
            className={!isLogin ? 'active' : ''}
            onClick={() => {
              setIsLogin(false);
              setError(null);
            }}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleAuthAction} className="auth-form">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            aria-label="Email Address"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            aria-label="Password"
          />
          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? 'Processing...' : isLogin ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        {error && <p className="auth-error" role="alert">{error}</p>}

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
      </div>
    </div>
  );
};

export default Auth;