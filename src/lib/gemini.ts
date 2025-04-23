import { GoogleGenerativeAI } from "@google/generative-ai";

// Gemini API configuration using environment variables
export const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// Validate that required environment variables are set
if (!GEMINI_API_KEY) {
  console.error('Missing Gemini API key. Check your .env file.');
}

// Initialize Google Generative AI client only if the key exists
let genAI: GoogleGenerativeAI | null = null;
let geminiModel: any = null; // Use 'any' or a more specific type if available from the library

if (GEMINI_API_KEY && GEMINI_API_KEY !== 'your_gemini_api_key_here') {
  try {
    console.log('Initializing Gemini AI with key:', GEMINI_API_KEY ? 'Key exists' : 'No key');
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    // Use the model name consistent with the previous URL or the example
    geminiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    console.log('Gemini AI Client Initialized with model: gemini-2.0-flash');
  } catch (error) {
    console.error('Failed to initialize Gemini AI Client:', error);
    // Handle initialization error, maybe disable the feature
  }
} else {
  console.warn('Gemini API key not configured or invalid. Summary generation will be disabled.');
}

export const generateSummaryWithGemini = async (text: string): Promise<string> => {
  // Check if the client and model were initialized successfully
  if (!geminiModel) {
    console.error('Gemini client not initialized. Cannot generate summary.');
    // Return a default message or throw an error
    return "Summary generation is unavailable due to configuration issues.";
  }

  try {
    console.log('Making Gemini API request via SDK...');
    console.log('Text length for summarization:', text.length);

    if (!text || text.trim().length === 0) {
      console.warn('Empty text provided for summarization');
      return "Unable to generate a summary: no content was found on the page.";
    }

    // Use a prompt similar to the example, tailored for summarization
    const prompt = `Summarize the following text in 3-4 concise sentences that capture the main points:

    ${text.substring(0, 10000)}`; // Keep the length limit

    console.log('Prompt length:', prompt.length);

    // Use the generateContent method from the SDK
    try {
      const result = await geminiModel.generateContent(prompt);
      console.log('Gemini API request successful, processing response...');
      
      const response = await result.response;
      console.log('Response received:', response ? 'Has response' : 'No response');
      
      const summaryText = response.text(); // Use the text() method to get the response
      console.log('Summary text extracted, length:', summaryText?.length || 0);

      if (summaryText) {
        return summaryText.trim();
      } else {
        console.error('Empty response from Gemini API');
        return "Unable to generate summary from the provided text.";
      }
    } catch (apiError: any) {
      console.error('Error during Gemini API call:', apiError);
      console.error('Error details:', apiError.message, apiError.stack);
      return `Error with AI service: ${apiError.message || 'Unknown API error'}`;
    }

  } catch (error: any) {
    console.error('Error generating summary with Gemini SDK:', error);
    console.error('Error type:', typeof error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    // Provide more specific error handling based on potential SDK errors
    if (error.message && error.message.includes('API key not valid')) {
       return "Summary generation failed due to an invalid API key.";
    }
    
    if (error.message && error.message.includes('model not found')) {
       return "Summary generation failed. The specified AI model could not be found.";
    }
    
    // Provide a generic error message with details
    return `Error generating summary: ${error.message || 'Unknown error'}`;
  }
};