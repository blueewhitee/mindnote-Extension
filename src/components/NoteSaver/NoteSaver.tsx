import React, { useState } from 'react';
import './NoteSaver.css';
import { supabase } from '../../lib/supabase';
import { generateSummaryWithGemini } from '../../lib/gemini';
import type { Note } from '../../lib/supabase';

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

  const generateSummary = async () => {
    try {
      setIsSaving(true);
      setMessage('Generating summary...');
      
      console.log('Attempting to get current tab info...');
      // Get current tab info first
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]) {
        setCurrentUrl(tabs[0].url || '');
        setPageTitle(tabs[0].title || '');
        console.log('Successfully retrieved tab info:', { url: tabs[0].url, title: tabs[0].title });
      } else {
        console.error('No active tab found');
        throw new Error('No active tab found');
      }
      
      console.log('Executing content script to extract page content...');
      // Execute a content script to extract page content
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.id) {
        console.error('No tab ID available');
        throw new Error('No tab ID available');
      }
      
      try {
        // Using chrome.scripting.executeScript instead of browser.tabs.executeScript
        const results = await chrome.scripting.executeScript({
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
            // Use Gemini to generate a better summary
            console.log('Calling Gemini API for summary...');
            setMessage('Using AI to generate a better summary...');
            summaryText = await generateSummaryWithGemini(pageText);
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
        setHasGeneratedSummary(true);
        setMessage('');
        
      } catch (scriptError) {
        console.error('Error executing content script:', scriptError);
        throw new Error(`Script execution error: ${scriptError.message || 'Unknown error'}`);
      }
      
    } catch (error) {
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
      const { session } = await chrome.storage.local.get('session');
      
      if (!session) {
        throw new Error('Authentication required');
      }
      
      // Create a new note in Supabase
      const { data, error } = await supabase
        .from('notes')
        .insert({
          user_id: user.uid,
          title: pageTitle,
          content: currentUrl, // Storing URL as content
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

  const handleLogout = async () => {
    try {
      // Sign out from Supabase
      await supabase.auth.signOut();
      // Clear local storage using Chrome API
      await chrome.storage.local.remove(['session', 'user']);
      onLogout();
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  const toggleSummaryMethod = () => {
    setIsUsingAI(!isUsingAI);
  };

  return (
    <div className="note-saver dark">
      <div className="header">
        <h2>Save Page Note</h2>
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