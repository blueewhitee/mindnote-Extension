import { createClient } from '@supabase/supabase-js';

// Get Supabase credentials from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate that required environment variables are set
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Check your .env file.');
}

// Create Supabase client with browser extension-friendly options
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: false, // Don't use localStorage in extensions
    detectSessionInUrl: false, // Don't auto-detect URL fragments in extensions
    flowType: 'pkce' // Use PKCE flow for added security
  },
  global: {
    headers: {
      'X-Client-Info': 'mindnotes-extension'
    }
  }
});

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type Note = {
  id: string;
  user_id: string;
  title: string;
  content: string | null;
  summary: string | null;
  metadata?: any; // Adding optional metadata field for concept map data
  is_archived: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type Bookmark = {
  id: string;
  user_id: string;
  title: string;
  url: string;
  description: string | null;
  tags: string[] | null;
  favicon_url: string | null;
  is_favorite: boolean;
  created_at: string | null;
  updated_at: string | null;
  folder_id: string | null;
};

export type BookmarkFolder = {
  id: string;
  user_id: string;
  name: string;
  parent_folder_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};