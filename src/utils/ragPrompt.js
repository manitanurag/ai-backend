
export const generateQuestionsPrompt = (jobDescription, numberOfQuestions = 10) => {
  return `You are an expert technical interviewer. Based on the following job description, generate exactly ${numberOfQuestions} relevant, specific interview questions that would help assess if a candidate is suitable for this role.

Job Description:
${jobDescription}

Requirements:
- Generate exactly ${numberOfQuestions} questions
- Include a mix of:
  * Technical questions (40-50% of questions) - specific to required skills and technologies
  * Behavioral/situational questions (30-40%) - STAR method friendly
  * Experience-based questions (20-30%) - based on role requirements
- Questions should be clear, specific, and directly related to the JD
- Progress from easier to more challenging questions
- Format: Return as a JSON array of strings

Example format:
["Question 1 here?", "Question 2 here?", "Question 3 here?", ...]

IMPORTANT: Return ONLY the JSON array, no additional text or explanation.`;
};


export const generateEvaluationPrompt = (question, answer, relevantChunks) => {
  const resumeContext = relevantChunks
    .filter(chunk => chunk.source === 'resume')
    .map(chunk => chunk.text)
    .join('\n\n');
  
  const jdContext = relevantChunks
    .filter(chunk => chunk.source === 'job_description')
    .map(chunk => chunk.text)
    .join('\n\n');

  return `You are an expert interview evaluator. Evaluate the candidate's answer using their resume and the job description as context.

Question: ${question}

Candidate's Answer: ${answer}

Resume Context:
${resumeContext || 'No resume context available'}

Job Description Context:
${jdContext || 'No job description context available'}

Please evaluate the answer and provide:
1. A score from 1-10 (where 10 is excellent)
2. Detailed feedback on:
   - Relevance to the question
   - Alignment with resume experience
   - Fit for the job requirements
   - Areas of improvement
3. Specific citations from resume or JD that support your evaluation

Return your response in the following JSON format:
{
  "score": 8,
  "feedback": "Detailed feedback here...",
  "citations": [
    {
      "source": "resume",
      "text": "Relevant text from resume"
    }
  ]
}`;
};


export const getSystemPrompt = () => {
  return `You are an AI interview assistant. Your role is to:
1. Ask relevant interview questions based on the job description
2. Evaluate candidate answers using their resume as context
3. Provide constructive feedback and scores
4. Maintain a professional and encouraging tone
5. Help candidates improve their interview skills

Always be fair, objective, and helpful in your evaluations.`;
};
