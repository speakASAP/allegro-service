/**
 * Allegro OAuth Callback Page
 * Handles Auth microservice token handoff and Allegro OAuth callback responses.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import {
  HOSTED_AUTH_STATE_KEY,
  clearHostedAuthState,
  consumeHostedAuthReturnTo,
} from '../services/hostedAuth';

type CallbackStatus = 'loading' | 'success' | 'error';

interface AuthJwtPayload {
  sub?: string | number;
  id?: string | number;
  userId?: string | number;
  email?: string;
  firstName?: string;
  lastName?: string;
  given_name?: string;
  family_name?: string;
}

const decodeJwtPayload = (token: string): AuthJwtPayload => {
  const [, payload] = token.split('.');
  if (!payload) {
    return {};
  }

  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const json = window.atob(padded);
  return JSON.parse(json) as AuthJwtPayload;
};

const storeHostedAuthSession = (fragment: URLSearchParams): string => {
  const accessToken = fragment.get('access_token');
  const returnedState = fragment.get('state');
  const expectedState = localStorage.getItem(HOSTED_AUTH_STATE_KEY);

  if (!accessToken) {
    throw new Error('Auth response did not include an access token.');
  }

  if (!expectedState || returnedState !== expectedState) {
    throw new Error('Auth state validation failed. Please sign in again.');
  }

  const refreshToken = fragment.get('refresh_token');
  const payload = decodeJwtPayload(accessToken);
  const user = {
    id: String(payload.sub || payload.id || payload.userId || payload.email || 'auth-user'),
    email: payload.email || '',
    firstName: payload.firstName || payload.given_name || undefined,
    lastName: payload.lastName || payload.family_name || undefined,
  };

  localStorage.setItem('accessToken', accessToken);
  if (refreshToken) {
    localStorage.setItem('refreshToken', refreshToken);
  } else {
    localStorage.removeItem('refreshToken');
  }
  localStorage.setItem('user', JSON.stringify(user));

  return consumeHostedAuthReturnTo();
};

const AllegroOAuthCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<CallbackStatus>('loading');
  const [message, setMessage] = useState('');
  const [title, setTitle] = useState('Authorization');

  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));

    if (fragment.has('access_token')) {
      setTitle('Alfares Auth');

      try {
        const returnTo = storeHostedAuthSession(fragment);
        clearHostedAuthState();
        window.history.replaceState(null, document.title, window.location.pathname);
        setStatus('success');
        setMessage('Sign-in successful. Redirecting...');

        const timer = setTimeout(() => {
          navigate(returnTo, { replace: true });
        }, 300);

        return () => clearTimeout(timer);
      } catch (error) {
        clearHostedAuthState();
        window.history.replaceState(null, document.title, window.location.pathname);
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Could not complete Auth sign-in.');
        return;
      }
    }

    setTitle('Allegro OAuth Authorization');

    const success = searchParams.get('success');
    const error = searchParams.get('error');
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (error) {
      setStatus('error');
      let errorMessage = '';

      if (error === 'access_denied') {
        errorMessage = 'Authorization was denied. Please try again and grant the required permissions.';
      } else if (error === 'invalid_state' || error === 'state_mismatch') {
        errorMessage = 'OAuth state validation failed. This usually happens if the authorization process took too long or was interrupted. Please try authorizing again by clicking the "Authorize OAuth" button.';
      } else if (error === 'client_secret_missing' || error.includes('clientSecret')) {
        errorMessage = 'Client Secret is missing. Please go to Settings, enter your Allegro Client Secret, and click Save before authorizing.';
      } else if (error === 'client_secret_empty') {
        errorMessage = 'Client Secret is empty. Please go to Settings, re-enter your Allegro Client Secret, and click Save.';
      } else if (error === 'decryption_failed') {
        errorMessage = 'Failed to decrypt Client Secret. Please go to Settings, re-enter your Client Secret, and click Save.';
      } else {
        errorMessage = `Authorization failed: ${error}`;
      }

      setMessage(errorMessage);
      return;
    }

    if (success === 'true') {
      setStatus('success');
      setMessage('Authorization successful! Redirecting to settings...');

      const timer = setTimeout(() => {
        navigate('/dashboard/settings?oauth_refresh=true');
      }, 2000);

      return () => clearTimeout(timer);
    }

    if (code && state) {
      setStatus('loading');
      setMessage('Processing authorization...');
      return;
    }

    setStatus('error');
    setMessage('Invalid callback parameters. Please try again.');
  }, [searchParams, navigate]);

  const handleGoToSettings = () => {
    navigate('/dashboard/settings');
  };

  const handleGoToLogin = () => {
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card title={title}>
        <div className="space-y-4">
          {status === 'loading' && (
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">{message || 'Processing authorization...'}</p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center">
              <div className="text-green-600 text-5xl mb-4">✓</div>
              <p className="text-gray-700 mb-4">{message}</p>
              <Button onClick={handleGoToSettings}>Go to Settings</Button>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <div className="text-red-600 text-5xl mb-4">✗</div>
              <p className="text-red-700 mb-4">{message}</p>
              <Button onClick={title === 'Alfares Auth' ? handleGoToLogin : handleGoToSettings}>
                {title === 'Alfares Auth' ? 'Sign in again' : 'Go to Settings'}
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default AllegroOAuthCallbackPage;
