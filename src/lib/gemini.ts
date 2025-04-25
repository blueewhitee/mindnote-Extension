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

export const generateSummaryWithGemini = async (text: string, url?: string): Promise<string> => {
  // Check if the client and model were initialized successfully
  if (!geminiModel) {
    console.error('Gemini client not initialized. Cannot generate summary.');
    // Return a default message or throw an error
    return "Summary generation is unavailable due to configuration issues.";
  }

  try {
    console.log('Making Gemini API request via SDK...');
    
    // Special handling for YouTube URLs
    const isYouTube = url && (url.includes('youtube.com') || url.includes('youtu.be'));
    
    if (isYouTube) {
      console.log('YouTube URL detected, using specialized YouTube summary approach');
      return await generateYouTubeSummaryWithGemini(url);
    }
    
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

// New function for YouTube-specific summaries
async function generateYouTubeSummaryWithGemini(youtubeUrl: string): Promise<string> {
  try {
    console.log('Generating YouTube-specific summary for:', youtubeUrl);
    
    // Create a specialized prompt for YouTube videos
    const prompt = `
    You are a helpful assistant that summarizes YouTube videos.
    
    Please analyze the YouTube video at this URL: ${youtubeUrl}
    
    Generate a summary that includes:
    1. The likely main topic of the video
    2. What viewers might learn or experience from watching it
    3. Any notable context based on the channel or video type
    
    Provide the summary in 3-4 clear, concise sentences.
    `;
    
    console.log('YouTube summary prompt created');
    
    // Use the generateContent method from the SDK
    const result = await geminiModel.generateContent(prompt);
    const response = await result.response;
    const summaryText = response.text();
    
    console.log('YouTube summary generated, length:', summaryText?.length || 0);
    
    if (summaryText) {
      return summaryText.trim();
    } else {
      console.error('Empty response from Gemini API for YouTube summary');
      return "Unable to generate summary for this YouTube video.";
    }
  } catch (error: any) {
    console.error('Error generating YouTube summary with Gemini:', error);
    return `Error generating YouTube video summary: ${error.message || 'Unknown error'}`;
  }
}

export const generateConceptMapWithGemini = async (text: string, url: string, summary: string): Promise<any> => {
  // Check if the client and model were initialized successfully
  if (!geminiModel) {
    console.error('Gemini client not initialized. Cannot generate concept map.');
    // Return a default message or throw an error
    return {
      error: "Concept map generation is unavailable due to configuration issues."
    };
  }

  try {
    console.log('Making Gemini API request for concept map...');
    console.log('Text length for concept map generation:', text.length);

    if (!text || text.trim().length === 0) {
      console.warn('Empty text provided for concept map generation');
      return {
        error: "Unable to generate a concept map: no content was found on the page."
      };
    }

    // Create prompt that includes instruction to use URL and summary in the response
    const prompt = `
    Analyze the following content and extract:
    1. Main concepts (5-10 key ideas)
    2. Relationships between concepts
    3. Theme categorization for concepts (technology, business, science, philosophy, personal, health)
    4. Importance level for each concept (1-3, with 3 being most important)
    
    Format your response as a JSON object with exactly this structure:
    {
      "url": "${url}",
      "summary": "${summary.replace(/"/g, '\\"')}",
      "concepts": [
        {
          "id": "concept-1",
          "label": "concept name",
          "theme": "theme name",
          "importance": 2
        },
        ...more concepts
      ],
      "relationships": [
        {
          "source": "concept-1",
          "target": "concept-2", 
          "label": "relationship description"
        },
        ...more relationships
      ]
    }

    Content to analyze:
    ${text.substring(0, 10000)}
    
    Only respond with valid JSON. No explanations or additional text.
    `;

    console.log('Prompt created for concept map generation');

    // Use the generateContent method from the SDK
    try {
      const result = await geminiModel.generateContent(prompt);
      console.log('Gemini API request for concept map successful, processing response...');
      
      const response = await result.response;
      console.log('Response received for concept map:', response ? 'Has response' : 'No response');
      
      const responseText = response.text();
      console.log('Concept map text extracted, length:', responseText?.length || 0);

      if (responseText) {
        try {
          // Parse the JSON response
          const conceptMap = JSON.parse(responseText.trim());
          return conceptMap;
        } catch (parseError) {
          console.error('Error parsing concept map JSON:', parseError);
          // Fallback to simulated data
          return generateFallbackConceptMap(text, url, summary);
        }
      } else {
        console.error('Empty response from Gemini API for concept map');
        return generateFallbackConceptMap(text, url, summary);
      }
    } catch (apiError: any) {
      console.error('Error during Gemini API call for concept map:', apiError);
      return generateFallbackConceptMap(text, url, summary);
    }
  } catch (error: any) {
    console.error('Error generating concept map with Gemini SDK:', error);
    return generateFallbackConceptMap(text, url, summary);
  }
};

// Fallback function to generate a concept map when the API fails
function generateFallbackConceptMap(text: string, url: string, summary: string) {
  // Extract potential concepts from the content
  const words = text.split(/\s+/).filter(word => word.length > 4);
  
  // Select a subset of words as concepts (to avoid overcrowding)
  const concepts = [...new Set(words)]
    .slice(0, Math.min(10, words.length))
    .map((word, index) => ({
      id: `concept-${index}`,
      label: word.replace(/[^\w\s]/gi, ''),
      theme: getRandomTheme(),
      importance: Math.floor(Math.random() * 3) + 1 // 1-3 importance level
    }));
  
  // Generate relationships between concepts
  const relationships = [];
  for (let i = 0; i < concepts.length; i++) {
    // Connect each concept to 1-3 other concepts
    const numConnections = Math.floor(Math.random() * 3) + 1;
    for (let j = 0; j < numConnections; j++) {
      const targetIndex = (i + j + 1) % concepts.length;
      relationships.push({
        source: concepts[i].id,
        target: concepts[targetIndex].id,
        label: getRandomRelationship()
      });
    }
  }
  
  return { 
    url,
    summary,
    concepts, 
    relationships 
  };
}

function getRandomTheme() {
  const themes = ['technology', 'business', 'science', 'personal', 'health', 'philosophy'];
  return themes[Math.floor(Math.random() * themes.length)];
}

function getRandomRelationship() {
  const relationships = ['relates to', 'influences', 'depends on', 'part of', 'type of', 'leads to'];
  return relationships[Math.floor(Math.random() * relationships.length)];
}