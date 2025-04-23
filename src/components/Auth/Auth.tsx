import React, { useState, useEffect } from 'react';
import './Auth.css';
import { supabase } from '../../lib/supabase';

interface AuthProps {
  onLogin: (userData: { email: string, uid: string }) => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    console.log("Supabase client initialized:", !!supabase);
    console.log("Auth methods available:", !!supabase?.auth);
    
    // Check if we have an active session on component mount
    const checkExistingSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (data?.session && data.session.user) {
        console.log("Found existing session:", data.session.user.email);
        onLogin({ 
          email: data.session.user.email || '', 
          uid: data.session.user.id 
        });
      }
    };
    
    checkExistingSession();
  }, [onLogin]);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Sign in initiated with email:", email);
    setIsLoading(true);
    setError('');
    
    try {
      console.log("Calling supabase.auth.signInWithPassword...");
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      console.log("Sign in response:", { data: { ...data, session: data?.session ? "Session exists" : "No session" }, error });
      
      if (error) {
        console.error("Login error:", error);
        throw error;
      }
      
      // Check if we successfully got a session
      if (!data.session) {
        console.error("No session returned from signInWithPassword");
        throw new Error("Login failed - no session created");
      }
      
      console.log("Login successful, session established");
      
      // Store auth session in extension storage
      await browser.storage.local.set({ 
        session: data.session,
        user: { email: data.user.email, uid: data.user.id }
      });
      
      // Wait for the session to be fully established
      await new Promise(resolve => setTimeout(resolve, 500));
      
      showToast("Success", "You have successfully signed in.");
      onLogin({ email: data.user.email || '', uid: data.user.id });
    } catch (err: any) {
      console.error("Login error caught:", err);
      setError(err.message || 'Sign in failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      // Get the extension's redirect URL
      const redirectURL = chrome.identity.getRedirectURL();
      console.log("Extension redirect URL:", redirectURL);
      
      // Use Supabase OAuth for Google sign in
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectURL,
          // Don't add scopes here - they're configured in Supabase
        }
      });
      
      if (error) throw error;
      
      if (!data.url) {
        throw new Error("No OAuth URL returned from Supabase");
      }
      
      console.log("OAuth URL generated:", data.url);
      
      // For browser extension environment, use chrome.identity.launchWebAuthFlow
      chrome.identity.launchWebAuthFlow({
        url: data.url,
        interactive: true
      }, async (redirectUrl) => {
        console.log("Auth flow completed, redirect URL:", redirectUrl ? "URL received" : "No URL");
        
        if (chrome.runtime.lastError) {
          console.error("Chrome identity error:", chrome.runtime.lastError);
          setError('Google login failed: ' + chrome.runtime.lastError.message);
          setIsLoading(false);
          return;
        }
        
        if (!redirectUrl) {
          setError('Authentication failed - no redirect URL returned');
          setIsLoading(false);
          return;
        }
        
        try {
          // Log the full redirect URL for debugging
          console.log("Full redirect URL:", redirectUrl);
          
          // Parse the URL to extract the auth info
          const url = new URL(redirectUrl);
          
          // Look for code in the query parameters
          let code = url.searchParams.get('code');
          
          // If not found in query params, check the hash fragment
          if (!code && url.hash) {
            const hashParams = new URLSearchParams(url.hash.substring(1));
            code = hashParams.get('code');
            
            // If still not found, look for access_token in hash (implicit flow)
            if (!code) {
              const accessToken = hashParams.get('access_token');
              if (accessToken) {
                console.log("Found access_token in hash, using token directly");
                
                // Get user info using the token
                const { data, error } = await supabase.auth.getUser(accessToken);
                
                if (error) {
                  throw error;
                }
                
                if (data.user) {
                  // Store session in browser storage
                  const session = {
                    access_token: accessToken,
                    user: data.user
                  };
                  
                  await browser.storage.local.set({
                    session,
                    user: { 
                      email: data.user.email, 
                      uid: data.user.id
                    }
                  });
                  
                  showToast("Success", "You have successfully signed in with Google.");
                  onLogin({ 
                    email: data.user.email || '', 
                    uid: data.user.id 
                  });
                  setIsLoading(false);
                  return;
                }
              }
            }
          }
          
          // If we found a code, exchange it for a session
          if (code) {
            console.log("Authentication code received, exchanging for session...");
            
            // Exchange the code for a session
            const { data, error } = await supabase.auth.exchangeCodeForSession(code);
            
            if (error) {
              console.error("Session exchange error:", error);
              throw error;
            }
            
            if (!data.session) {
              throw new Error("No session returned from code exchange");
            }
            
            console.log("Successfully authenticated with Google");
            
            // Store the session data
            await browser.storage.local.set({
              session: data.session,
              user: { 
                email: data.session.user.email, 
                uid: data.session.user.id
              }
            });
            
            showToast("Success", "You have successfully signed in with Google.");
            onLogin({ 
              email: data.session.user.email || '', 
              uid: data.session.user.id 
            });
          } else {
            throw new Error("No authentication code or token found in redirect URL");
          }
        } catch (err: any) {
          console.error("Error processing auth redirect:", err);
          setError(err.message || 'Failed to process authentication');
        } finally {
          setIsLoading(false);
        }
      });
    } catch (err: any) {
      console.error("Google sign in error:", err);
      setError(err.message || 'Google login failed');
      setIsLoading(false);
    }
  };
  
  const showToast = (title: string, message: string, isError: boolean = false) => {
    // In a browser extension, we'll use a simple approach instead of a toast library
    const toastEl = document.createElement('div');
    toastEl.className = `auth-toast ${isError ? 'error' : 'success'}`;
    toastEl.innerHTML = `
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    `;
    document.body.appendChild(toastEl);
    setTimeout(() => {
      toastEl.classList.add('show');
      setTimeout(() => {
        toastEl.classList.remove('show');
        setTimeout(() => toastEl.remove(), 300);
      }, 3000);
    }, 100);
  };

  return (
    <div className="auth-card dark">
      <div className="card-header">
        <h2 className="card-title">Welcome to MindNotes</h2>
        <p className="card-description">
          Capture and organize your thoughts with AI assistance
        </p>
      </div>
      
      <div className="card-content">
        <form onSubmit={handleEmailSignIn} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
          <button type="submit" className="submit-button" disabled={isLoading}>
            {isLoading ? (
              <svg className="spinner" viewBox="0 0 50 50">
                <circle className="path" cx="25" cy="25" r="20" fill="none" strokeWidth="5"></circle>
              </svg>
            ) : null}
            Sign In
          </button>
        </form>
        
        {error && <div className="error-message">{error}</div>}
      </div>
      
      <div className="card-footer">
        <div className="divider">
          <span>Or continue with</span>
        </div>
        <button 
          className="google-button" 
          onClick={handleGoogleSignIn} 
          disabled={isLoading}
        >
          <svg className="google-icon" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Google
        </button>
      </div>
    </div>
  );
};

export default Auth;