import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import './BookmarkFolder.css';
import type { BookmarkFolder } from '../../lib/supabase';

interface BookmarkFolderProps {
  user: { email: string; uid: string };
  onFolderSelect: (folderId: string | null) => void;
  selectedFolderId: string | null;
}

const BookmarkFolderManager: React.FC<BookmarkFolderProps> = ({ 
  user, 
  onFolderSelect, 
  selectedFolderId 
}) => {
  const [folders, setFolders] = useState<BookmarkFolder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [parentFolderId, setParentFolderId] = useState<string | null>(null);

  useEffect(() => {
    fetchFolders();
  }, [user.uid]);

  const fetchFolders = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('bookmark_folders')
        .select('id, name, parent_id')
        .eq('user_id', user.uid)
        .order('name');
      
      if (error) throw error;
      
      const fetchedFolders: BookmarkFolder[] = (data || []).map(f => ({ 
        ...f, 
        parent_folder_id: f.parent_id 
      }));
      setFolders(fetchedFolders);

    } catch (err: any) {
      console.error('Error fetching folders:', err);
      setError('Failed to load folders. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) {
      setError('Folder name cannot be empty');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('bookmark_folders')
        .insert({
          user_id: user.uid,
          name: newFolderName.trim(),
          parent_id: parentFolderId
        })
        .select('id, name, parent_id');
      
      if (error) throw error;
      
      if (data && data.length > 0) {
         const newFolder: BookmarkFolder = { ...data[0], parent_folder_id: data[0].parent_id };
         setFolders([...folders, newFolder].sort((a, b) => a.name.localeCompare(b.name)));
      }
      
      setNewFolderName('');
      setParentFolderId(null);
      setShowCreateModal(false);
    } catch (err: any) {
      console.error('Error creating folder:', err);
      setError('Failed to create folder. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateModal = (parentId: string | null = null) => {
    setNewFolderName('');
    setParentFolderId(parentId);
    setShowCreateModal(true);
    setError(null);
  };

  const buildFolderOptions = (currentParentId: string | null = null, depth = 0): JSX.Element[] => {
    const children = folders.filter(f => f.parent_folder_id === currentParentId); 
    let options: JSX.Element[] = [];

    children.forEach(folder => {
      const indentation = '\u00A0\u00A0'.repeat(depth * 2);
      options.push(
        <option key={folder.id} value={folder.id} className={`folder-option-dropdown depth-${depth}`}>
          {indentation}📁 {folder.name}
        </option>
      );
      options = options.concat(buildFolderOptions(folder.id, depth + 1));
    });

    return options;
  };

  const CreateFolderModal = () => (
    <div className="folder-modal-backdrop">
      <div className="folder-modal">
        <h3>Create New Folder</h3>
        {error && <div className="folder-error">{error}</div>}
        <div className="folder-form">
          <div className="form-group">
            <label htmlFor="folderName">Folder Name</label>
            <input
              id="folderName"
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Enter folder name"
              autoFocus
            />
          </div>
          <div className="folder-modal-actions">
            <button 
              className="cancel-btn" 
              onClick={() => setShowCreateModal(false)}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button 
              className="create-btn" 
              onClick={createFolder}
              disabled={isLoading || !newFolderName.trim()}
            >
              {isLoading ? 'Creating...' : 'Create Folder'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="bookmark-folder-manager">
      <div className="folder-header">
        <label htmlFor="folderSelector" className="folder-select-label">View Folder:</label>
        <select 
          id="folderSelector"
          className="folder-select-dropdown"
          value={selectedFolderId === null ? '' : selectedFolderId}
          onChange={(e) => onFolderSelect(e.target.value || null)}
          disabled={isLoading}
        >
          <option value="">📚 All Bookmarks</option>
          {buildFolderOptions()} 
        </select>
        <button 
          className="new-folder-btn-simple" 
          onClick={() => openCreateModal()}
          aria-label="Create new folder"
          title="Create New Folder"
          disabled={isLoading}
        >
          +
        </button>
      </div>
      
      {isLoading && folders.length === 0 && <div className="loading-folders">Loading...</div>}
      {error && <div className="folder-error">{error}</div>} 
      
      {showCreateModal && <CreateFolderModal />}
    </div>
  );
};

export default BookmarkFolderManager;