import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import './BookmarkList.css';
import type { Bookmark, BookmarkFolder } from '../../lib/supabase';

interface BookmarkListProps {
  user: { email: string; uid: string };
  selectedFolderId: string | null;
  selectedFolderName?: string;
}

const BookmarkList: React.FC<BookmarkListProps> = ({
  user,
  selectedFolderId,
  selectedFolderName
}) => {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchBookmarks();
  }, [user.uid, selectedFolderId]);

  const fetchBookmarks = async () => {
    setIsLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('bookmarks')
        .select('id, title, url, created_at, favicon_url, folder_id')
        .eq('user_id', user.uid)
        .order('created_at', { ascending: false });

      if (selectedFolderId) {
        query = query.eq('folder_id', selectedFolderId);
      }

      const { data, error } = await query;

      if (error) throw error;

      setBookmarks(data || []);
    } catch (err: any) {
      console.error('Error fetching bookmarks:', err);
      setError('Failed to load bookmarks. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (bookmarkId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this bookmark?')) {
      return;
    }
    try {
      const { error } = await supabase
        .from('bookmarks')
        .delete()
        .eq('id', bookmarkId);

      if (error) throw error;

      setBookmarks(bookmarks.filter(b => b.id !== bookmarkId));
    } catch (err: any) {
      console.error('Error deleting bookmark:', err);
      setError('Failed to delete bookmark.');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleEdit = (bookmark: Bookmark, e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('Edit bookmark:', bookmark);
    alert(`Editing: ${bookmark.title}`);
  };

  const handleBookmarkClick = (bookmark: Bookmark) => {
    if (bookmark.url) {
      window.open(bookmark.url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const filteredBookmarks = bookmarks.filter(bookmark => {
    const searchLower = searchQuery.toLowerCase();
    return (
      bookmark.title?.toLowerCase().includes(searchLower) ||
      bookmark.url?.toLowerCase().includes(searchLower) ||
      bookmark.description?.toLowerCase().includes(searchLower)
    );
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const defaultFavicon = '/icon/16.png';

  return (
    <div className="bookmark-list">
      <div className="bookmark-list-header">
        <h3>{selectedFolderName ? `Bookmarks in ${selectedFolderName}` : 'All Bookmarks'}</h3>
        <div className="search-container">
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={handleSearch}
            className="search-input"
          />
        </div>
      </div>

      <div className="bookmark-list-content">
        {isLoading ? (
          <div className="loading-bookmarks">Loading...</div>
        ) : error ? (
          <div className="bookmark-error">{error}</div>
        ) : filteredBookmarks.length === 0 ? (
          <div className="no-bookmarks">
            {searchQuery
              ? 'No matches found.'
              : selectedFolderId
              ? 'Folder is empty.'
              : 'No bookmarks yet.'}
          </div>
        ) : (
          <ul className="bookmarks">
            {filteredBookmarks.map(bookmark => (
              <li
                key={bookmark.id}
                className="bookmark-item"
                onClick={() => handleBookmarkClick(bookmark)}
                title={`URL: ${bookmark.url}\nCreated: ${formatDate(bookmark.created_at)}`}
              >
                <img
                  src={bookmark.favicon_url || defaultFavicon}
                  alt=""
                  className="bookmark-favicon"
                  onError={(e) => (e.currentTarget.src = defaultFavicon)}
                />
                <div className="bookmark-info">
                  <div className="bookmark-title">
                    {bookmark.title || 'Untitled Bookmark'}
                  </div>
                </div>
                <div className="bookmark-actions">
                  <button
                    className="bookmark-action-btn edit-btn"
                    onClick={(e) => handleEdit(bookmark, e)}
                    aria-label="Edit bookmark"
                    title="Edit bookmark"
                  >
                    ✏️
                  </button>
                  <button
                    className="bookmark-action-btn delete-btn"
                    onClick={(e) => handleDelete(bookmark.id, e)}
                    aria-label="Delete bookmark"
                    title="Delete bookmark"
                  >
                    🗑️
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default BookmarkList;