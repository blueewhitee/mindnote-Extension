import React, { useState, useEffect } from 'react';
import './NoteSaver.css';
import { supabase } from '../../lib/supabase';
import { generateSummaryWithGemini } from '../../lib/gemini';
import type { Note, Bookmark, BookmarkFolder } from '../../lib/supabase';
import BookmarkFolderManager from '../BookmarkFolder/BookmarkFolder';
import BookmarkList from '../BookmarkFolder/BookmarkList';

interface NoteSaverProps {
  user: { email: string; uid: string };
  onLogout: () => void;
}

const NoteSaver: React.FC<NoteSaverProps> = ({ user, onLogout }) => {
  const [currentUrl, setCurrentUrl] = useState('');
  const [pageTitle, setPageTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [hasGeneratedSummary, setHasGeneratedSummary] = useState(false);
  const [isUsingAI, setIsUsingAI] = useState(true);
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [showBookmarkForm, setShowBookmarkForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'save' | 'bookmarks'>('save');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [folderIdForBookmark, setFolderIdForBookmark] = useState<string | null>(null);
  const [showQuickSaveFolder, setShowQuickSaveFolder] = useState(false);
  const [selectedFolderName, setSelectedFolderName] = useState<string | null>(null);
  const [folders, setFolders] = useState<BookmarkFolder[]>([]);

  const getCurrentPageInfo = async () => {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
      const currentTabUrl = tabs[0].url || '';
      const title = tabs[0].title || '';
      return { url: currentTabUrl, title };
    }
    throw new Error('No active tab found');
  };

  useEffect(() => {
    if (activeTab === 'save' && !hasGeneratedSummary && !currentUrl) {
      getCurrentPageInfo().then(info => {
        setCurrentUrl(info.url);
        setPageTitle(info.title);
      }).catch(err => {
        console.error('Error getting page info:', err);
      });
    }
  }, [activeTab]);

  useEffect(() => {
    const fetchFoldersData = async () => {
      if (!user?.uid) return;
      try {
        const { data, error } = await supabase
          .from('bookmark_folders')
          .select('id, name')
          .eq('user_id', user.uid);
        if (error) throw error;
        setFolders(data || []);
      } catch (err) {
        console.error("Error fetching folder names:", err);
      }
    };
    fetchFoldersData();
  }, [user?.uid]);

  const generateSummary = async () => {
    try {
      setIsSaving(true);
      setMessage('Generating summary...');
      
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]) {
        const currentTabUrl = tabs[0].url || '';
        setCurrentUrl(currentTabUrl);
        setPageTitle(tabs[0].title || '');
        
        const isYouTube = currentTabUrl && (currentTabUrl.includes('youtube.com') || currentTabUrl.includes('youtu.be'));
        
        if (isYouTube && isUsingAI) {
          try {
            const summaryText = await generateSummaryWithGemini('', currentTabUrl);
            setSummary(summaryText);
            setDescription(summaryText.substring(0, 150) + (summaryText.length > 150 ? '...' : ''));
            setHasGeneratedSummary(true);
            setMessage('');
            setIsSaving(false);
            return;
          } catch (youtubeError) {
            setMessage('YouTube summary failed, using standard approach instead...');
          }
        }
      } else {
        throw new Error('No active tab found');
      }
      
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.id) {
        throw new Error('No tab ID available');
      }
      
      try {
        const results = await browser.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const article = document.querySelector('article') || document.body;
            const textContent = article.innerText
              .replace(/\s+/g, ' ')
              .trim()
              .substring(0, 10000);
            return textContent;
          }
        });
        
        const pageText = results[0]?.result as string;
        
        if (!pageText || pageText.trim().length === 0) {
          console.warn('Extracted text is empty');
        }
        
        let summaryText = '';
        
        if (isUsingAI) {
          try {
            setMessage('Using AI to generate a better summary...');
            summaryText = await generateSummaryWithGemini(pageText, currentUrl);
          } catch (aiError) {
            setMessage('AI summary failed, using basic summary instead...');
            summaryText = pageText.split(/[.!?]+/).slice(0, 3).join('. ') + '.';
          }
        } else {
          summaryText = pageText.split(/[.!?]+/).slice(0, 3).join('. ') + '.';
        }
        
        setSummary(summaryText);
        setDescription(summaryText.substring(0, 150) + (summaryText.length > 150 ? '...' : ''));
        setHasGeneratedSummary(true);
        setMessage('');
        
      } catch (scriptError: any) {
        throw new Error(`Script execution error: ${scriptError.message || 'Unknown error'}`);
      };
      
    } catch (error: any) {
      setMessage(`Failed to generate summary: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const saveNote = async () => {
    try {
      setIsSaving(true);
      setSaveStatus('idle');
      setMessage('Saving note...');
      
      const { session } = await browser.storage.local.get('session');
      
      if (!session) {
        throw new Error('Authentication required');
      }

      const formattedContent = `URL: ${currentUrl}\n\n${summary}`;
      
      const { data, error } = await supabase
        .from('notes')
        .insert({
          user_id: user.uid,
          title: pageTitle,
          content: formattedContent,
          summary: summary,
          is_archived: false
        })
        .select();
      
      if (error) throw error;
      
      setSaveStatus('success');
      setMessage('Note saved successfully!');
      
      setTimeout(() => {
        setSaveStatus('idle');
        setMessage('');
      }, 3000);
      
    } catch (error: any) {
      setSaveStatus('error');
      setMessage(`Error: ${error.message || 'Failed to save note'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const saveBookmark = async () => {
    try {
      setIsSaving(true);
      setSaveStatus('idle');
      setMessage('Saving bookmark...');

      if (!currentUrl) {
        const pageInfo = await getCurrentPageInfo();
        setCurrentUrl(pageInfo.url);
        setPageTitle(pageInfo.title);
      }

      const faviconUrl = `https://www.google.com/s2/favicons?domain=${new URL(currentUrl).hostname}&sz=64`;
      
      const tags = tagsInput.trim() ? tagsInput.split(',').map(tag => tag.trim()) : null;

      const { data, error } = await supabase
        .from('bookmarks')
        .insert({
          user_id: user.uid,
          url: currentUrl,
          title: pageTitle,
          description: description || summary.substring(0, 150),
          tags: tags,
          favicon_url: faviconUrl,
          is_favorite: false,
          folder_id: folderIdForBookmark
        })
        .select();
      
      if (error) throw error;
      
      setSaveStatus('success');
      setMessage('Bookmark saved successfully!');
      setShowBookmarkForm(false);
      
      setTimeout(() => {
        setSaveStatus('idle');
        setMessage('');
      }, 3000);
      
    } catch (error: any) {
      setSaveStatus('error');
      setMessage(`Error: ${error.message || 'Failed to save bookmark'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const quickSaveBookmark = async () => {
    try {
      setIsSaving(true);
      setSaveStatus('idle');
      setMessage('Saving bookmark...');
      
      const pageInfo = await getCurrentPageInfo();
      
      const faviconUrl = `https://www.google.com/s2/favicons?domain=${new URL(pageInfo.url).hostname}&sz=64`;
      
      const { data, error } = await supabase
        .from('bookmarks')
        .insert({
          user_id: user.uid,
          url: pageInfo.url,
          title: pageInfo.title,
          favicon_url: faviconUrl,
          is_favorite: false,
          folder_id: folderIdForBookmark
        })
        .select();
      
      if (error) throw error;
      
      setSaveStatus('success');
      setMessage('Quick bookmark saved!');
      
      setTimeout(() => {
        setSaveStatus('idle');
        setMessage('');
      }, 3000);
      
    } catch (error: any) {
      setSaveStatus('error');
      setMessage(`Error: ${error.message || 'Failed to save bookmark'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      await browser.storage.local.remove(['session', 'user']);
      onLogout();
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  const toggleSummaryMethod = () => {
    setIsUsingAI(!isUsingAI);
  };

  const toggleBookmarkForm = () => {
    setShowBookmarkForm(!showBookmarkForm);
    
    if (!showBookmarkForm && summary && !description) {
      setDescription(summary.substring(0, 150) + (summary.length > 150 ? '...' : ''));
    }
  };

  const toggleQuickSaveFolder = () => {
    setShowQuickSaveFolder(!showQuickSaveFolder);
  };

  const handleFolderSelect = (folderId: string | null) => {
    setSelectedFolderId(folderId);
    setFolderIdForBookmark(folderId);
    const folder = folders.find(f => f.id === folderId);
    setSelectedFolderName(folder ? folder.name : null);
  };

  const TabNavigation = () => (
    <div className="tab-navigation">
      <button
        className={`tab-btn ${activeTab === 'save' ? 'active' : ''}`}
        onClick={() => setActiveTab('save')}
      >
        Save Page
      </button>
      <button
        className={`tab-btn ${activeTab === 'bookmarks' ? 'active' : ''}`}
        onClick={() => setActiveTab('bookmarks')}
      >
        My Bookmarks
      </button>
    </div>
  );

  return (
    <div className="note-saver dark">
      <div className="header">
        <h2>MindNotes</h2>
        <div className="user-info">
          <span>{user.email}</span>
          <button className="logout-btn" onClick={handleLogout}>Logout</button>
        </div>
      </div>
      
      <TabNavigation />

      {activeTab === 'save' ? (
        <>
          {hasGeneratedSummary ? (
            <>
              <div className="page-info">
                <h3>{pageTitle}</h3>
                <a href={currentUrl} target="_blank" rel="noopener noreferrer">
                  {currentUrl}
                </a>
              </div>

              <div className="action-buttons">
                <button 
                  className="bookmark-btn"
                  onClick={toggleBookmarkForm}
                  disabled={isSaving}
                >
                  <svg className="bookmark-icon" viewBox="0 0 24 24" width="16" height="16">
                    <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" fill="currentColor"/>
                  </svg>
                  {showBookmarkForm ? 'Hide Bookmark Form' : 'Add Bookmark'}
                </button>
                
                <div className="quick-save-container">
                  <button 
                    className="quick-bookmark-btn"
                    onClick={quickSaveBookmark}
                    disabled={isSaving}
                  >
                    <svg className="bookmark-icon" viewBox="0 0 24 24" width="16" height="16">
                      <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" fill="currentColor"/>
                    </svg>
                    Quick Save
                  </button>
                  <button 
                    className="folder-toggle-btn"
                    onClick={toggleQuickSaveFolder}
                    title="Select folder"
                  >
                    {folderIdForBookmark ? '📁*' : '📁'}
                  </button>
                </div>
              </div>

              {showQuickSaveFolder && (
                <div className="quick-folder-selector">
                  <label htmlFor="quickFolderSelect">Save to Folder:</label>
                  <select
                    id="quickFolderSelect"
                    value={folderIdForBookmark || ''}
                    onChange={(e) => setFolderIdForBookmark(e.target.value || null)}
                    disabled={isSaving}
                  >
                    <option value="">None (Root Level)</option>
                    <FolderOptions userId={user.uid} />
                  </select>
                </div>
              )}

              <div className="summary-section">
                <div className="summary-header">
                  <h4>Page Summary</h4>
                  <div className="summary-controls">
                    <label className="ai-toggle">
                      <input 
                        type="checkbox" 
                        checked={isUsingAI} 
                        onChange={toggleSummaryMethod}
                        disabled={isSaving}
                      />
                      <span className="toggle-label">Use AI</span>
                    </label>
                    <button 
                      onClick={generateSummary} 
                      disabled={isSaving}
                      className="generate-btn"
                    >
                      Refresh
                    </button>
                  </div>
                </div>
                
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Generate or enter a summary of this page..."
                  rows={5}
                  disabled={isSaving}
                />
              </div>
              
              <button 
                className={`save-btn ${saveStatus}`}
                onClick={saveNote}
                disabled={isSaving || !summary.trim()}
              >
                {isSaving ? 'Saving...' : 'Save Note'}
              </button>
            </>
          ) : (
            <div className="generate-summary-prompt">
              <p>Click the button below to capture the current page and generate a summary.</p>
              
              <div className="quick-save-section">
                <div className="quick-save-container centered">
                  <button 
                    className="quick-bookmark-btn standalone"
                    onClick={quickSaveBookmark}
                    disabled={isSaving}
                  >
                    <svg className="bookmark-icon" viewBox="0 0 24 24" width="16" height="16">
                      <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" fill="currentColor"/>
                    </svg>
                    Quick Bookmark (No Summary)
                  </button>
                  <button 
                    className="folder-toggle-btn"
                    onClick={toggleQuickSaveFolder}
                    title="Select folder"
                  >
                    {folderIdForBookmark ? '📁*' : '📁'}
                  </button>
                </div>
                
                {showQuickSaveFolder && (
                  <div className="quick-folder-selector">
                    <label htmlFor="quickFolderSelect2">Save to Folder:</label>
                    <select
                      id="quickFolderSelect2"
                      value={folderIdForBookmark || ''}
                      onChange={(e) => setFolderIdForBookmark(e.target.value || null)}
                      disabled={isSaving}
                    >
                      <option value="">None (Root Level)</option>
                      <FolderOptions userId={user.uid} />
                    </select>
                  </div>
                )}
              </div>
              
              <div className="divider">
                <span>OR</span>
              </div>
              
              <div className="summary-method">
                <label className="ai-toggle">
                  <input 
                    type="checkbox" 
                    checked={isUsingAI} 
                    onChange={toggleSummaryMethod}
                  />
                  <span className="toggle-label">Use AI for better summaries</span>
                </label>
              </div>
              <button 
                onClick={generateSummary} 
                disabled={isSaving}
                className="generate-summary-btn"
              >
                {isSaving ? 'Processing...' : 'Generate Summary'}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="bookmarks-manager">
          <BookmarkFolderManager 
            user={user} 
            onFolderSelect={handleFolderSelect} 
            selectedFolderId={selectedFolderId} 
          />
          <hr className="section-separator" />
          <BookmarkList 
            user={user} 
            selectedFolderId={selectedFolderId} 
            selectedFolderName={selectedFolderName || undefined} 
          />
        </div>
      )}
      
      {message && (
        <div className={`status-message ${saveStatus}`}>
          {message}
        </div>
      )}
    </div>
  );
};

// Helper component to fetch and display folder options for the select dropdown
const FolderOptions = ({ userId }: { userId: string }) => {
  const [folders, setFolders] = useState<BookmarkFolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchFolders = async () => {
      setIsLoading(true);
      setError(null);
      setFolders([]); // Clear previous folders
      
      try {
        console.log('Fetching folders for dropdown for user:', userId);
        
        if (!userId) {
          console.error('No user ID provided for folder dropdown fetch');
          setError('No user ID available');
          setIsLoading(false);
          return;
        }
        
        // Fetch using the correct 'parent_id' column from the schema
        const { data, error: fetchError } = await supabase
          .from('bookmark_folders')
          .select('id, name, parent_id') // Corrected: use parent_id
          .eq('user_id', userId)
          .order('name');
        
        if (fetchError) {
          console.error('Supabase error fetching folders for dropdown:', fetchError);
          setError(`Failed to load folders: ${fetchError.message}`);
          setIsLoading(false);
          return;
        }
        
        console.log('Folders fetched for dropdown:', data?.length || 0);
        // Ensure the fetched data matches the expected type, mapping parent_id
        const fetchedFolders: BookmarkFolder[] = (data || []).map(f => ({ 
          ...f, 
          parent_folder_id: f.parent_id // Map parent_id to parent_folder_id if needed internally, or adjust type
        }));
        setFolders(fetchedFolders);
        
      } catch (err: any) {
        console.error('Error in fetchFolders for dropdown:', err);
        setError(`Error loading folders: ${err.message || 'Unknown error'}`);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchFolders();
  }, [userId]);
  
  // Simple recursive function to build options with indentation
  const buildOptions = (currentParentId: string | null = null, depth = 0): JSX.Element[] => {
    // Filter children based on the correct 'parent_id' field
    const children = folders.filter(f => f.parent_id === currentParentId);
    let options: JSX.Element[] = [];

    children.forEach(folder => {
      const indentation = '\u00A0\u00A0'.repeat(depth * 2); // Use non-breaking spaces for indentation
      options.push(
        <option key={folder.id} value={folder.id} className={`folder-option depth-${depth}`}>
          {indentation}📁 {folder.name}
        </option>
      );
      // Recursively add children using the folder's id as the next parentId
      options = options.concat(buildOptions(folder.id, depth + 1));
    });

    return options;
  };

  if (isLoading) {
    return <option disabled>Loading folders...</option>;
  }
  
  if (error) {
    console.error('Folder options rendering error:', error);
    // Display the error state clearly in the dropdown
    return <option disabled>Error: {error}</option>; 
  }
  
  // If no folders and not loading/error, return null so the default "None" option is the only one
  if (folders.length === 0) {
    return null; 
  }
  
  // Build the options starting from the root (null parentId)
  const folderOptions = buildOptions();

  // If after building, there are no options (e.g., only empty folders), return null
  if (folderOptions.length === 0 && folders.length > 0) {
     console.log("No root folders found to display.");
     return null; // Or perhaps a message like <option disabled>No top-level folders</option>
  }

  return <>{folderOptions}</>;
};

export default NoteSaver;