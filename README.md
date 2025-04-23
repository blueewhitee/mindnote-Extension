# MindNotes - Browser Extension

MindNotes is a powerful browser extension that helps you save web page links and summaries as notes in your account. It uses AI (Google's Gemini API) to generate concise summaries of web content and organize information into concept maps.

## Features

- **AI-Powered Summaries**: Automatically generate concise summaries of web pages using Google's Gemini 2.0 Flash model
- **Secure Authentication**: Sign in with email/password or Google OAuth
- **Notes Management**: Save and organize notes from web content
- **Dark Mode Support**: Comfortable viewing experience in any lighting condition
- **Concept Mapping**: Visualize relationships between key concepts in your saved content


## Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" using the toggle in the top-right corner
   - Click "Load unpacked" and select the `dist/` folder created by the build process
   - The MindNotes extension should now appear in your extensions list and be available in the toolbar

## How to Use

1. Click on the MindNotes icon in your browser toolbar
2. Sign in with your email/password or Google account
3. When viewing a webpage you want to save, click the MindNotes icon
4. The extension will automatically generate a summary of the page content
5. Add any additional notes or tags, then click "Save"
6. Access your saved notes from any device by logging into your MindNotes account


## Technologies

- **Frontend**: React 19
- **Build System**: WXT (WebExtension Tooling)
- **Authentication**: Supabase Auth
- **Database**: Supabase
- **AI**: Google Generative AI (Gemini API)
- **Storage**: Browser extension storage APIs
