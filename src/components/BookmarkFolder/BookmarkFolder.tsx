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
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [parentFolderId, setParentFolderId] = useState<string | null>(null);
  const [currentFolder, setCurrentFolder] = useState<BookmarkFolder | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Fetch folders
  useEffect(() => {
    fetchFolders();
  }, [user.uid]);

  const fetchFolders = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('bookmark_folders')
        .select('*')
        .eq('user_id', user.uid)
        .order('name');
      
      if (error) throw error;
      
      setFolders(data || []);
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
          parent_folder_id: parentFolderId
        })
        .select();
      
      if (error) throw error;
      
      // Add the new folder to the state
      if (data && data.length > 0) {
        setFolders([...folders, data[0]]);
        
        // If the new folder has a parent, expand the parent
        if (parentFolderId) {
          setExpandedFolders(prev => {
            const newSet = new Set(prev);
            newSet.add(parentFolderId);
            return newSet;
          });
        }
      }
      
      // Reset form
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

  const updateFolder = async () => {
    if (!currentFolder || !newFolderName.trim()) {
      setError('Folder name cannot be empty');
      return;
    }

    if (currentFolder.id === parentFolderId) {
      setError('A folder cannot be its own parent');
      return;
    }

    // Check if creating a circular reference
    if (parentFolderId) {
      let tempParentId = parentFolderId;
      const visited = new Set<string>();
      
      while (tempParentId && !visited.has(tempParentId)) {
        visited.add(tempParentId);
        const tempFolder = folders.find(f => f.id === tempParentId);
        if (!tempFolder) break;
        
        // If we find the current folder in the parent chain, we have a circular reference
        if (tempFolder.parent_folder_id === currentFolder.id) {
          setError('Circular folder reference detected');
          return;
        }
        
        tempParentId = tempFolder.parent_folder_id || '';
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('bookmark_folders')
        .update({
          name: newFolderName.trim(),
          parent_folder_id: parentFolderId
        })
        .eq('id', currentFolder.id)
        .select();
      
      if (error) throw error;
      
      // Update the folder in the state
      const updatedFolders = folders.map(f => 
        f.id === currentFolder.id ? data[0] : f
      );
      
      setFolders(updatedFolders);
      setShowEditModal(false);
      setNewFolderName('');
      setParentFolderId(null);
      setCurrentFolder(null);
    } catch (err: any) {
      console.error('Error updating folder:', err);
      setError('Failed to update folder. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteFolder = async () => {
    if (!currentFolder) return;

    setIsLoading(true);
    setError(null);

    try {
      // First, update any bookmarks in this folder to have no folder
      const { error: bookmarkError } = await supabase
        .from('bookmarks')
        .update({ folder_id: null })
        .eq('folder_id', currentFolder.id);
      
      if (bookmarkError) throw bookmarkError;
      
      // Next, update any child folders to have the current folder's parent
      const { error: childFolderError } = await supabase
        .from('bookmark_folders')
        .update({ parent_folder_id: currentFolder.parent_folder_id })
        .eq('parent_folder_id', currentFolder.id);
      
      if (childFolderError) throw childFolderError;
      
      // Finally, delete the folder
      const { error } = await supabase
        .from('bookmark_folders')
        .delete()
        .eq('id', currentFolder.id);
      
      if (error) throw error;
      
      // Update state by removing the deleted folder
      setFolders(folders.filter(f => f.id !== currentFolder.id));
      
      // If the deleted folder was selected, set selected to null
      if (selectedFolderId === currentFolder.id) {
        onFolderSelect(null);
      }
      
      setShowDeleteModal(false);
      setCurrentFolder(null);
    } catch (err: any) {
      console.error('Error deleting folder:', err);
      setError('Failed to delete folder. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFolderClick = (folder: BookmarkFolder) => {
    onFolderSelect(folder.id);
  };

  const toggleFolderExpand = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  const openCreateModal = (parentId: string | null = null) => {
    setNewFolderName('');
    setParentFolderId(parentId);
    setShowCreateModal(true);
    setError(null);
  };

  const openEditModal = (folder: BookmarkFolder) => {
    setCurrentFolder(folder);
    setNewFolderName(folder.name);
    setParentFolderId(folder.parent_folder_id);
    setShowEditModal(true);
    setError(null);
  };

  const openDeleteModal = (folder: BookmarkFolder) => {
    setCurrentFolder(folder);
    setShowDeleteModal(true);
    setError(null);
  };

  const buildFolderTree = (parentId: string | null = null, depth = 0): React.ReactNode => {
    const childFolders = folders.filter(folder => folder.parent_folder_id === parentId);
    
    if (childFolders.length === 0) {
      return null;
    }

    return (
      <ul className={`folder-list ${depth === 0 ? 'root-list' : 'nested-list'}`}>
        {childFolders.map(folder => {
          const hasChildren = folders.some(f => f.parent_folder_id === folder.id);
          const isExpanded = expandedFolders.has(folder.id);
          const isSelected = selectedFolderId === folder.id;
          
          return (
            <li key={folder.id} className={`folder-item ${isSelected ? 'selected' : ''}`}>
              <div className="folder-row" onClick={() => handleFolderClick(folder)}>
                <div className="folder-expand-icon" onClick={(e) => toggleFolderExpand(folder.id, e)}>
                  {hasChildren && (
                    <span className="expand-icon">
                      {isExpanded ? '▼' : '►'}
                    </span>
                  )}
                </div>
                <div className="folder-icon">📁</div>
                <div className="folder-name">
                  {folder.name}
                </div>
                <div className="folder-actions">
                  <button 
                    className="folder-action-btn edit-btn" 
                    onClick={(e) => { e.stopPropagation(); openEditModal(folder); }}
                    aria-label="Edit folder"
                  >
                    ✏️
                  </button>
                  <button 
                    className="folder-action-btn delete-btn" 
                    onClick={(e) => { e.stopPropagation(); openDeleteModal(folder); }}
                    aria-label="Delete folder"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              {hasChildren && isExpanded && buildFolderTree(folder.id, depth + 1)}
            </li>
          );
        })}
      </ul>
    );
  };

  // Helper to get a filtered list of folders for the parent dropdown
  // Excludes the current folder being edited and its children
  const getAvailableParentFolders = (): BookmarkFolder[] => {
    if (!currentFolder) return folders;
    
    // Function to check if a folder is a descendant of currentFolder
    const isDescendant = (folderId: string): boolean => {
      const childFolders = folders.filter(f => f.parent_folder_id === folderId);
      return childFolders.some(f => 
        f.id === currentFolder.id || isDescendant(f.id)
      );
    };
    
    return folders.filter(f => 
      f.id !== currentFolder.id && !isDescendant(f.id)
    );
  };

  // Modal for creating a new folder
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
          <div className="form-group">
            <label htmlFor="parentFolder">Parent Folder (Optional)</label>
            <select
              id="parentFolder"
              value={parentFolderId || ''}
              onChange={(e) => setParentFolderId(e.target.value || null)}
            >
              <option value="">None (Root Level)</option>
              {folders.map(folder => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
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
              disabled={isLoading}
            >
              {isLoading ? 'Creating...' : 'Create Folder'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Modal for editing a folder
  const EditFolderModal = () => (
    <div className="folder-modal-backdrop">
      <div className="folder-modal">
        <h3>Edit Folder</h3>
        {error && <div className="folder-error">{error}</div>}
        <div className="folder-form">
          <div className="form-group">
            <label htmlFor="editFolderName">Folder Name</label>
            <input
              id="editFolderName"
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Enter folder name"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label htmlFor="editParentFolder">Parent Folder (Optional)</label>
            <select
              id="editParentFolder"
              value={parentFolderId || ''}
              onChange={(e) => setParentFolderId(e.target.value || null)}
            >
              <option value="">None (Root Level)</option>
              {getAvailableParentFolders().map(folder => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </div>
          <div className="folder-modal-actions">
            <button 
              className="cancel-btn" 
              onClick={() => setShowEditModal(false)}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button 
              className="save-btn" 
              onClick={updateFolder}
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Modal for confirming folder deletion
  const DeleteFolderModal = () => (
    <div className="folder-modal-backdrop">
      <div className="folder-modal">
        <h3>Delete Folder</h3>
        {error && <div className="folder-error">{error}</div>}
        <p>
          Are you sure you want to delete "{currentFolder?.name}"?
        </p>
        <p className="delete-warning">
          Any bookmarks in this folder will be moved to the root level.
          Any subfolders will be moved up one level.
        </p>
        <div className="folder-modal-actions">
          <button 
            className="cancel-btn" 
            onClick={() => setShowDeleteModal(false)}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button 
            className="delete-btn" 
            onClick={deleteFolder}
            disabled={isLoading}
          >
            {isLoading ? 'Deleting...' : 'Delete Folder'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="bookmark-folder-manager">
      <div className="folder-header">
        <h3>Folders</h3>
        <button 
          className="new-folder-btn" 
          onClick={() => openCreateModal()}
          aria-label="Create new folder"
        >
          <span className="new-folder-icon">+</span>
          <span className="new-folder-text">New Folder</span>
        </button>
      </div>
      
      <div className="folder-tree-container">
        <div className="all-bookmarks-item" onClick={() => onFolderSelect(null)}>
          <div className="folder-icon">📚</div>
          <div className={`folder-name ${selectedFolderId === null ? 'selected' : ''}`}>
            All Bookmarks
          </div>
        </div>
        
        {isLoading && folders.length === 0 ? (
          <div className="loading-folders">Loading folders...</div>
        ) : error ? (
          <div className="folder-error">{error}</div>
        ) : folders.length === 0 ? (
          <div className="no-folders">
            No folders created yet. Create your first folder to organize bookmarks.
          </div>
        ) : (
          buildFolderTree()
        )}
      </div>
      
      {showCreateModal && <CreateFolderModal />}
      {showEditModal && <EditFolderModal />}
      {showDeleteModal && <DeleteFolderModal />}
    </div>
  );
};

export default BookmarkFolderManager;