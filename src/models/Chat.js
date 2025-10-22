import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['system', 'user', 'assistant'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  score: {
    type: Number,
    min: 1,
    max: 10
  },
  feedback: {
    type: String
  },
  citations: [{
    source: String, // 'resume' or 'job_description'
    text: String
  }],
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const chatSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  resumeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
    required: true
  },
  jobDescriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
    required: true
  },
  messages: [messageSchema],
  generatedQuestions: [{
    question: String,
    answered: {
      type: Boolean,
      default: false
    }
  }],
  averageScore: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'completed'],
    default: 'active'
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Calculate average score before saving
chatSchema.methods.calculateAverageScore = function() {
  const scoredMessages = this.messages.filter(msg => msg.score);
  if (scoredMessages.length === 0) return 0;
  
  const totalScore = scoredMessages.reduce((sum, msg) => sum + msg.score, 0);
  return (totalScore / scoredMessages.length).toFixed(2);
};

const Chat = mongoose.model('Chat', chatSchema);

export default Chat;
