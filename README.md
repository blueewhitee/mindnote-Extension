# MindNotes - Browser Extension

MindNotes is a powerful browser extension that helps you save web page links and summaries as notes in your account. It uses AI (Google's Gemini API) to generate concise summaries of web content and organize information into concept maps.

## Features

- **AI-Powered Summaries**: Automatically generate concise summaries of web pages using Google's Gemini 2.0 Flash model
- **Secure Authentication**: Sign in with email/password or Google OAuth
- **Notes Management**: Save and organize notes from web content
- **Bookmark Organization**: Create and manage bookmarks with custom folders and tags
- **Quick Bookmarking**: Save pages with a single click without requiring a summary
- **Folder Hierarchy**: Organize bookmarks in a nested folder structure for better organization
- **Search Functionality**: Quickly find saved bookmarks with the integrated search feature
- **YouTube Support**: Special summary generation for YouTube videos
- **Dark Mode Support**: Comfortable viewing experience in any lighting condition
- **Concept Mapping**: Visualize relationships between key concepts in your saved content

## Installation

### Chrome and Chromium-based browsers (Edge, Brave, etc.):
1. Download the extension ZIP file
2. Extract the ZIP file to a folder on your computer
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable "Developer mode" using the toggle in the top-right corner
5. Click "Load unpacked" and select the `.output/` folder created by the build process
6. The MindNotes extension should now appear in your extensions list and be available in the toolbar

### Firefox:
1. Download the extension ZIP file
2. Open Firefox and navigate to `about:addons`
3. Click the gear icon and select "Install Add-on From File..."
4. Browse to and select the ZIP file
5. Follow the prompts to complete installation

## How to Use

1. Click on the MindNotes icon in your browser toolbar
2. Sign in with your email/password or Google account
3. When viewing a webpage you want to save, click the MindNotes icon

### Saving Content:
- **Generate Summary**: Click "Generate Summary" to use AI to analyze the current page
- **Quick Bookmark**: Use "Quick Bookmark" to save the page without generating a summary
- **Save to Folders**: Select a destination folder when saving bookmarks
- **Add Tags**: Tag your bookmarks for easier categorization and searching

### Managing Bookmarks:
- Switch to the "My Bookmarks" tab to view and manage your saved bookmarks
- Create folders and subfolders to organize your bookmarks
- Search through your bookmarks using the search box
- Click on any bookmark to open it in a new tab
- Edit or delete bookmarks as needed

## Technologies

- **Frontend**: React 19
- **Build System**: WXT (WebExtension Tooling)
- **Authentication**: Supabase Auth
- **Database**: Supabase
- **AI**: Google Generative AI (Gemini API)
- **Storage**: Browser extension storage APIs
