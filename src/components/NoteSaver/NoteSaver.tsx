import React, { useState } from 'react';
import './NoteSaver.css';
import { supabase } from '../../lib/supabase';
import { generateSummaryWithGemini } from '../../lib/gemini';
import type { Note, Bookmark } from '../../lib/supabase';

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

  const getCurrentPageInfo = async () => {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
      const currentTabUrl = tabs[0].url || '';
      const title = tabs[0].title || '';
      return { url: currentTabUrl, title };
    }
    throw new Error('No active tab found');
  };

  const generateSummary = async () => {
    try {
      setIsSaving(true);
      setMessage('Generating summary...');
      
      console.log('Attempting to get current tab info...');
      // Get current tab info first
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]) {
        const currentTabUrl = tabs[0].url || '';
        setCurrentUrl(currentTabUrl);
        setPageTitle(tabs[0].title || '');
        console.log('Successfully retrieved tab info:', { url: currentTabUrl, title: tabs[0].title });
        
        // Check if this is a YouTube URL
        const isYouTube = currentTabUrl && (currentTabUrl.includes('youtube.com') || currentTabUrl.includes('youtu.be'));
        
        if (isYouTube && isUsingAI) {
          console.log('YouTube URL detected, generating YouTube-specific summary...');
          setMessage('Generating YouTube-specific summary...');
          
          try {
            // Call Gemini directly with the URL for YouTube videos
            const summaryText = await generateSummaryWithGemini('', currentTabUrl);
            
            console.log('YouTube summary generated successfully, length:', summaryText.length);
            setSummary(summaryText);
            setDescription(summaryText.substring(0, 150) + (summaryText.length > 150 ? '...' : ''));
            setHasGeneratedSummary(true);
            setMessage('');
            setIsSaving(false);
            return; // Exit early since we've already generated the summary
          } catch (youtubeError) {
            console.error('Error with YouTube summary, falling back to standard approach:', youtubeError);
            setMessage('YouTube summary failed, using standard approach instead...');
            // Continue with the standard approach below
          }
        }
      } else {
        console.error('No active tab found');
        throw new Error('No active tab found');
      }
      
      console.log('Executing content script to extract page content...');
      // Execute a content script to extract page content
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.id) {
        console.error('No tab ID available');
        throw new Error('No tab ID available');
      }
      
      try {
        // Using browser.scripting.executeScript instead of chrome.scripting.executeScript
        const results = await browser.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            // Simple text extraction from the page
            const article = document.querySelector('article') || document.body;
            const textContent = article.innerText
              .replace(/\s+/g, ' ')
              .trim()
              .substring(0, 10000); // First 10000 chars
            return textContent;
          }
        });
        
        console.log('Page content extracted successfully');
        
        const pageText = results[0]?.result as string;
        
        if (!pageText || pageText.trim().length === 0) {
          console.warn('Extracted text is empty');
        }
        
        let summaryText = '';
        
        if (isUsingAI) {
          try {
            // Pass both the page text and URL to Gemini
            console.log('Calling Gemini API for summary...');
            setMessage('Using AI to generate a better summary...');
            summaryText = await generateSummaryWithGemini(pageText, currentUrl);
            console.log('Gemini summary generated successfully, length:', summaryText.length);
          } catch (aiError) {
            console.error('Error with AI summary, falling back to basic summary:', aiError);
            setMessage('AI summary failed, using basic summary instead...');
            // Fallback to basic summary if AI fails
            summaryText = pageText.split(/[.!?]+/).slice(0, 3).join('. ') + '.';
          }
        } else {
          // Basic summary generation
          console.log('Using basic summary generation...');
          summaryText = pageText.split(/[.!?]+/).slice(0, 3).join('. ') + '.';
        }
        
        setSummary(summaryText);
        // Set a shorter description for bookmarks
        setDescription(summaryText.substring(0, 150) + (summaryText.length > 150 ? '...' : ''));
        setHasGeneratedSummary(true);
        setMessage('');
        
      } catch (scriptError: any) {
        console.error('Error executing content script:', scriptError);
        throw new Error(`Script execution error: ${scriptError.message || 'Unknown error'}`);
      }
      
    } catch (error: any) {
      console.error('Error generating summary:', error);
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
      
      // Get session from storage
      const { session } = await browser.storage.local.get('session');
      
      if (!session) {
        throw new Error('Authentication required');
      }

      // Format content to include URL at the top followed by the summary
      const formattedContent = `URL: ${currentUrl}\n\n${summary}`;
      
      // Create a new note in Supabase
      const { data, error } = await supabase
        .from('notes')
        .insert({
          user_id: user.uid,
          title: pageTitle,
          content: formattedContent, // URL at top followed by summary
          summary: summary,
          is_archived: false
        })
        .select();
      
      if (error) throw error;
      
      setSaveStatus('success');
      setMessage('Note saved successfully!');
      
      // Reset after success
      setTimeout(() => {
        setSaveStatus('idle');
        setMessage('');
      }, 3000);
      
    } catch (error: any) {
      console.error('Error saving note:', error);
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

      // Get current tab info if not already available
      if (!currentUrl) {
        const pageInfo = await getCurrentPageInfo();
        setCurrentUrl(pageInfo.url);
        setPageTitle(pageInfo.title);
      }

      // Get favicon URL
      const faviconUrl = `https://www.google.com/s2/favicons?domain=${new URL(currentUrl).hostname}&sz=64`;
      
      // Process tags from input string to array
      const tags = tagsInput.trim() ? tagsInput.split(',').map(tag => tag.trim()) : null;

      // Save bookmark to Supabase
      const { data, error } = await supabase
        .from('bookmarks')
        .insert({
          user_id: user.uid,
          url: currentUrl,
          title: pageTitle,
          description: description || summary.substring(0, 150),
          tags: tags,
          favicon_url: faviconUrl,
          is_favorite: false
        })
        .select();
      
      if (error) throw error;
      
      setSaveStatus('success');
      setMessage('Bookmark saved successfully!');
      setShowBookmarkForm(false);
      
      // Reset after success
      setTimeout(() => {
        setSaveStatus('idle');
        setMessage('');
      }, 3000);
      
    } catch (error: any) {
      console.error('Error saving bookmark:', error);
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
      
      // Get current tab info
      const pageInfo = await getCurrentPageInfo();
      
      // Get favicon URL
      const faviconUrl = `https://www.google.com/s2/favicons?domain=${new URL(pageInfo.url).hostname}&sz=64`;
      
      // Save bookmark to Supabase with minimal info
      const { data, error } = await supabase
        .from('bookmarks')
        .insert({
          user_id: user.uid,
          url: pageInfo.url,
          title: pageInfo.title,
          favicon_url: faviconUrl,
          is_favorite: false
        })
        .select();
      
      if (error) throw error;
      
      setSaveStatus('success');
      setMessage('Quick bookmark saved!');
      
      // Reset after success
      setTimeout(() => {
        setSaveStatus('idle');
        setMessage('');
      }, 3000);
      
    } catch (error: any) {
      console.error('Error saving bookmark:', error);
      setSaveStatus('error');
      setMessage(`Error: ${error.message || 'Failed to save bookmark'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      // Sign out from Supabase
      await supabase.auth.signOut();
      // Clear local storage using browser API
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
    
    // If turning on the form and we have a summary but no description yet
    if (!showBookmarkForm && summary && !description) {
      setDescription(summary.substring(0, 150) + (summary.length > 150 ? '...' : ''));
    }
  };

  return (
    <div className="note-saver dark">
      <div className="header">
        <h2>MindNotes</h2>
        <div className="user-info">
          <span>{user.email}</span>
          <button className="logout-btn" onClick={handleLogout}>Logout</button>
        </div>
      </div>
      
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
          </div>

          {showBookmarkForm && (
            <div className="bookmark-form">
              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter a description for this bookmark"
                  rows={2}
                  disabled={isSaving}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="tags">Tags (comma-separated)</label>
                <input
                  id="tags"
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="e.g. research, work, later"
                  disabled={isSaving}
                />
              </div>
              
              <button 
                className={`save-bookmark-btn ${saveStatus}`}
                onClick={saveBookmark}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Bookmark'}
              </button>
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
      
      {message && (
        <div className={`status-message ${saveStatus}`}>
          {message}
        </div>
      )}
    </div>
  );
};

export default NoteSaver;