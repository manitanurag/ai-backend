import OpenAI from 'openai';

// OpenAI client will be initialized when needed
let openai = null;

const getOpenAIClient = () => {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    openai = new OpenAI({
      apiKey: apiKey,
      baseURL: "https://openrouter.ai/api/v1"
    });
  }
  return openai;
};


export const generateEmbedding = async (text) => {
  // Return empty array - we'll use text-based search instead of embeddings
  // This maintains compatibility with existing code structure
  return [];
};


export const cosineSimilarity = (vecA, vecB) => {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (magnitudeA * magnitudeB);
};


export const findRelevantChunks = async (query, documents, topK = 2) => {
  try {
    const allChunks = [];
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 3);

    for (const doc of documents) {
      if (doc.embeddings?.length > 0) {
        for (const embedding of doc.embeddings) {
          const textLower = embedding.text.toLowerCase();
          
          // Simple keyword matching score
          let score = 0;
          queryWords.forEach(word => {
            const count = (textLower.match(new RegExp(word, 'g')) || []).length;
            score += count;
          });

          allChunks.push({
            text: embedding.text,
            embedding: embedding.embedding || [],
            source: doc.fileType,
            documentId: doc._id,
            similarity: score,
          });
        }
      }
    }

    // Sort by keyword match score
    allChunks.sort((a, b) => b.similarity - a.similarity);
    return allChunks.slice(0, topK);
  } catch (error) {
    console.error('Error finding relevant chunks:', error);
    throw new Error('Failed to find relevant chunks');
  }
};
