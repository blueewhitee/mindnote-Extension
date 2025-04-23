import { supabase } from '../src/lib/supabase';

export default defineBackground(() => {
  console.log('MindNotes background script started');
  
  // Check for auth token expiration and refresh session if needed
  browser.alarms.create('checkAuthStatus', { periodInMinutes: 60 });
  
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
          }
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
      }
    }
  });
});
