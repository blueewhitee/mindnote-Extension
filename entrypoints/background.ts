import { supabase } from '../src/lib/supabase';

export default defineBackground(() => {
  console.log('MindNotes background script started');
  
  // Check for auth token expiration and refresh session if needed
  browser.alarms.create('checkAuthStatus', { periodInMinutes: 15 });
  
  // Function to handle OAuth redirects
  const handleOAuthRedirect = (details) => {
    if (details.url.includes('code=') || details.url.includes('access_token=')) {
      console.log('OAuth redirect detected:', details.url);
      // The chrome.identity API will handle this redirect automatically
      return;
    }
  };
  
  // Listen for navigation events that might be OAuth redirects
  if (browser.webNavigation) {
    browser.webNavigation.onCompleted.addListener(handleOAuthRedirect, {
      url: [{ schemes: ['https'] }]
    });
  }
  
  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'checkAuthStatus') {
      try {
        // Get session from storage
        const { session } = await browser.storage.local.get('session');
        
        if (session) {
          // Verify session is still valid
          const { data, error } = await supabase.auth.getUser(session.access_token);
          
          if (error || !data.user) {
            // Try to refresh the session
            const refreshResult = await supabase.auth.refreshSession(session);
            
            if (refreshResult.error) {
              // If refresh fails, clear session and log user out
              await browser.storage.local.remove(['session', 'user']);
              console.log('Auth session expired, user logged out');
            } else if (refreshResult.data.session) {
              // Update the session in storage
              await browser.storage.local.set({ 
                session: refreshResult.data.session
              });
              console.log('Auth session refreshed');
            }
          } else {
            console.log('Session is valid, user still authenticated:', data.user.email);
          }
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
      }
    }
  });
  
  // Listen for messages from content scripts or popup
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'getAuthStatus') {
      (async () => {
        try {
          const { user } = await browser.storage.local.get('user');
          sendResponse({ isAuthenticated: !!user, user });
        } catch (error) {
          console.error('Error getting auth status:', error);
          sendResponse({ isAuthenticated: false, error: error.message });
        }
      })();
      return true; // Indicates we will send a response asynchronously
    }
    
    if (message.type === 'logout') {
      (async () => {
        try {
          await supabase.auth.signOut();
          await browser.storage.local.remove(['session', 'user']);
          sendResponse({ success: true });
          console.log('User logged out');
        } catch (error) {
          console.error('Error logging out:', error);
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true; // Indicates we will send a response asynchronously
    }
  });
});
