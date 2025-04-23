export default defineContentScript({
  matches: ['<all_urls>'], // Match all pages
  main() {
    console.log('MindNotes content script loaded');
    
    // Listen for messages from popup
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'extractContent') {
        try {
          // Simple text extraction logic
          const article = document.querySelector('article') || document.body;
          const textContent = article.innerText
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 10000); // First 10000 chars
            
          sendResponse({ success: true, content: textContent });
        } catch (error) {
          console.error('Error extracting content:', error);
          sendResponse({ success: false, error: 'Failed to extract content' });
        }
        return true; // Keep the messaging channel open for async response
      }
    });
  },
});
