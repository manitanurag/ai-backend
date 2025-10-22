import mongoose from 'mongoose';

const embeddingSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true
  },
  embedding: {
    type: [Number],
    required: true
  },
  chunkIndex: {
    type: Number,
    required: true
  }
});

const documentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  fileName: {
    type: String,
    required: true
  },
  fileType: {
    type: String,
    enum: ['resume', 'job_description'],
    required: true
  },
  fileUrl: {
    type: String,
    required: true
  },
  cloudinaryPublicId: {
    type: String,
    required: true
  },
  extractedText: {
    type: String,
    required: true
  },
  embeddings: [embeddingSchema],
  uploadedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for faster queries
documentSchema.index({ userId: 1, fileType: 1 });

const Document = mongoose.model('Document', documentSchema);

export default Document;
