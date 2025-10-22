import Chat from '../models/Chat.js';
import Document from '../models/Document.js';
import OpenAI from 'openai';
import { findRelevantChunks } from '../utils/embeddings.js';
import { generateQuestionsPrompt, generateEvaluationPrompt, getSystemPrompt } from '../utils/ragPrompt.js';

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


export const startChat = async (req, res) => {
  try {
    // Get user's resume and job description
    const resume = await Document.findOne({
      userId: req.user._id,
      fileType: 'resume'
    });

    const jobDescription = await Document.findOne({
      userId: req.user._id,
      fileType: 'job_description'
    });

    if (!resume || !jobDescription) {
      return res.status(400).json({
        status: 'error',
        message: 'Please upload both resume and job description before starting an interview'
      });
    }

    // Generate interview questions using OpenAI (10 questions)
    const numberOfQuestions = 10;
    const questionsPrompt = generateQuestionsPrompt(jobDescription.extractedText, numberOfQuestions);
    
    const client = getOpenAIClient();
    const completion = await client.chat.completions.create({
      model: "openai/gpt-3.5-turbo",
      messages: [
        { role: "system", content: getSystemPrompt() },
        { role: "user", content: questionsPrompt }
      ],
      temperature: 0.8,
      max_tokens: 1000
    });

    let questions;
    try {
      const content = completion.choices[0].message.content.trim();
      // Remove any markdown code blocks if present
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      questions = JSON.parse(cleanContent);
      
      // Ensure we have the right number of questions
      if (!Array.isArray(questions) || questions.length < numberOfQuestions) {
        throw new Error('Invalid questions format');
      }
    } catch (error) {
      console.error('Error parsing questions:', error);
      // Fallback questions based on job description
      questions = [
        "Tell me about your most relevant experience for this role and how it aligns with the job requirements.",
        "What specific technical skills from the job description do you possess, and can you provide examples of how you've used them?",
        "Describe a challenging project you've worked on that relates to this position. What was your role and the outcome?",
        "How do you stay updated with the latest technologies and trends relevant to this field?",
        "Can you walk me through your approach to problem-solving when faced with a technical challenge?",
        "Tell me about a time you worked in a team. What was your contribution and how did you handle any conflicts?",
        "Describe a situation where you had to learn a new technology or skill quickly. How did you approach it?",
        "What interests you most about this role, and how does it fit into your career goals?",
        "Can you share an example of how you handled a tight deadline or competing priorities?",
        "Where do you see yourself growing in this role, and what value can you bring to our team?"
      ];
    }

    // Create chat session
    const chat = await Chat.create({
      userId: req.user._id,
      resumeId: resume._id,
      jobDescriptionId: jobDescription._id,
      generatedQuestions: questions.map(q => ({ question: q, answered: false })),
      messages: [
        {
          role: 'system',
          content: getSystemPrompt()
        },
        {
          role: 'assistant',
          content: `Hello! I'm your AI interviewer. I've reviewed the job description and I have ${questions.length} questions for you. Let's begin!\n\nQuestion 1: ${questions[0]}`
        }
      ]
    });

    res.status(201).json({
      status: 'success',
      message: 'Interview session started',
      data: {
        chatId: chat._id,
        questions: questions,
        firstQuestion: questions[0],
        totalQuestions: questions.length
      }
    });
  } catch (error) {
    console.error('Start chat error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error starting interview session',
      error: error.message
    });
  }
};


export const queryChat = async (req, res) => {
  try {
    const { chatId, message } = req.body;

    if (!chatId || !message) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide chatId and message'
      });
    }

    // Find chat session
    const chat = await Chat.findOne({
      _id: chatId,
      userId: req.user._id
    });

    if (!chat) {
      return res.status(404).json({
        status: 'error',
        message: 'Chat session not found'
      });
    }

    // Get resume and job description
    const [resume, jobDescription] = await Promise.all([
      Document.findById(chat.resumeId),
      Document.findById(chat.jobDescriptionId)
    ]);

    // Find current question
    const currentQuestionIndex = chat.generatedQuestions.findIndex(q => !q.answered);
    if (currentQuestionIndex === -1) {
      return res.status(400).json({
        status: 'error',
        message: 'All questions have been answered'
      });
    }

    const currentQuestion = chat.generatedQuestions[currentQuestionIndex].question;

    // Add user message to chat
    chat.messages.push({
      role: 'user',
      content: message
    });

    // Find relevant chunks using RAG
    const relevantChunks = await findRelevantChunks(
      message,
      [resume, jobDescription],
      2
    );

    // Generate evaluation using OpenAI
    const evaluationPrompt = generateEvaluationPrompt(currentQuestion, message, relevantChunks);

    const client = getOpenAIClient();
    const completion = await client.chat.completions.create({
      model: "openai/gpt-3.5-turbo",
      messages: [
        { role: "system", content: getSystemPrompt() },
        { role: "user", content: evaluationPrompt }
      ],
      temperature: 0.7,
      max_tokens: 800
    });

    let evaluation;
    try {
      evaluation = JSON.parse(completion.choices[0].message.content);
    } catch (error) {
      // Fallback evaluation
      evaluation = {
        score: 7,
        feedback: "Thank you for your answer. You've provided relevant information.",
        citations: []
      };
    }

    // Mark question as answered
    chat.generatedQuestions[currentQuestionIndex].answered = true;

    // Prepare response message
    let responseContent = `Score: ${evaluation.score}/10\n\nFeedback: ${evaluation.feedback}`;
    
    // Check if there are more questions
    const nextQuestionIndex = currentQuestionIndex + 1;
    if (nextQuestionIndex < chat.generatedQuestions.length) {
      const nextQuestion = chat.generatedQuestions[nextQuestionIndex].question;
      responseContent += `\n\nNext Question (${nextQuestionIndex + 1}/${chat.generatedQuestions.length}): ${nextQuestion}`;
    } else {
      // Interview completed
      chat.status = 'completed';
      chat.completedAt = Date.now();
      chat.averageScore = chat.calculateAverageScore();
      responseContent += `\n\n🎉 Interview completed! Your average score: ${chat.averageScore}/10`;
    }

    // Add assistant response to chat
    chat.messages.push({
      role: 'assistant',
      content: responseContent,
      score: evaluation.score,
      feedback: evaluation.feedback,
      citations: evaluation.citations || []
    });

    await chat.save();

    res.status(200).json({
      status: 'success',
      data: {
        score: evaluation.score,
        feedback: evaluation.feedback,
        citations: evaluation.citations,
        response: responseContent,
        hasMoreQuestions: nextQuestionIndex < chat.generatedQuestions.length,
        currentQuestion: nextQuestionIndex < chat.generatedQuestions.length ? nextQuestionIndex + 1 : null,
        totalQuestions: chat.generatedQuestions.length,
        completed: chat.status === 'completed',
        averageScore: chat.status === 'completed' ? chat.averageScore : null
      }
    });
  } catch (error) {
    console.error('Query chat error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error processing your answer',
      error: error.message
    });
  }
};


export const getChatHistory = async (req, res) => {
  try {
    const chat = await Chat.findOne({
      _id: req.params.chatId,
      userId: req.user._id
    });

    if (!chat) {
      return res.status(404).json({
        status: 'error',
        message: 'Chat session not found'
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        chat: {
          id: chat._id,
          messages: chat.messages,
          questions: chat.generatedQuestions,
          status: chat.status,
          averageScore: chat.averageScore,
          startedAt: chat.startedAt,
          completedAt: chat.completedAt
        }
      }
    });
  } catch (error) {
    console.error('Get chat history error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching chat history',
      error: error.message
    });
  }
};


export const getChatSessions = async (req, res) => {
  try {
    const chats = await Chat.find({ userId: req.user._id })
      .select('-messages -generatedQuestions.answered')
      .sort('-startedAt')
      .limit(10);

    res.status(200).json({
      status: 'success',
      data: {
        sessions: chats.map(chat => ({
          id: chat._id,
          status: chat.status,
          averageScore: chat.averageScore,
          questionsCount: chat.generatedQuestions.length,
          startedAt: chat.startedAt,
          completedAt: chat.completedAt
        }))
      }
    });
  } catch (error) {
    console.error('Get chat sessions error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching chat sessions',
      error: error.message
    });
  }
};
