import dotenv from 'dotenv';            
dotenv.config();

import Document from '../models/Document.js';
import multer from 'multer';

import fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';
import { extractTextFromPDF, chunkText, cleanupFile } from '../utils/pdfParser.js';
import { generateEmbedding } from '../utils/embeddings.js';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

export const uploadDocument = async (req, res) => {
  try {
    const { fileType } = req.body; // 'resume' or 'job_description'

    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'Please upload a PDF file'
      });
    }

    if (!fileType || !['resume', 'job_description'].includes(fileType)) {
      cleanupFile(req.file.path);
      return res.status(400).json({
        status: 'error',
        message: 'Invalid file type. Must be "resume" or "job_description"'
      });
    }

    // Extract text from PDF
    const extractedText = await extractTextFromPDF(req.file.path);

    if (!extractedText || extractedText.length < 50) {
      cleanupFile(req.file.path);
      return res.status(400).json({
        status: 'error',
        message: 'Could not extract sufficient text from PDF'
      });
    }

    // Upload to Cloudinary
    const cloudinaryResult = await cloudinary.uploader.upload(req.file.path, {
      folder: 'ai-interview-prep',
      resource_type: 'raw'
    });

    // Chunk text for embeddings
    const chunks = chunkText(extractedText, 500);

    // Generate embeddings for each chunk
    const embeddings = await Promise.all(
      chunks.map(async (chunk, index) => {
        const embedding = await generateEmbedding(chunk);
        return {
          text: chunk,
          embedding,
          chunkIndex: index
        };
      })
    );

    // Check if user already has this type of document
    const existingDoc = await Document.findOne({
      userId: req.user._id,
      fileType
    });

    if (existingDoc) {
      // Delete old file from Cloudinary
      await cloudinary.uploader.destroy(existingDoc.cloudinaryPublicId);
      
      // Update existing document
      existingDoc.fileName = req.file.originalname;
      existingDoc.fileUrl = cloudinaryResult.secure_url;
      existingDoc.cloudinaryPublicId = cloudinaryResult.public_id;
      existingDoc.extractedText = extractedText;
      existingDoc.embeddings = embeddings;
      existingDoc.uploadedAt = Date.now();
      
      await existingDoc.save();

      // Clean up local file
      cleanupFile(req.file.path);

      return res.status(200).json({
        status: 'success',
        message: `${fileType === 'resume' ? 'Resume' : 'Job Description'} updated successfully`,
        data: {
          document: {
            id: existingDoc._id,
            fileName: existingDoc.fileName,
            fileType: existingDoc.fileType,
            uploadedAt: existingDoc.uploadedAt
          }
        }
      });
    }

    // Create new document
    const document = await Document.create({
      userId: req.user._id,
      fileName: req.file.originalname,
      fileType,
      fileUrl: cloudinaryResult.secure_url,
      cloudinaryPublicId: cloudinaryResult.public_id,
      extractedText,
      embeddings
    });

    // Clean up local file
    cleanupFile(req.file.path);

    res.status(201).json({
      status: 'success',
      message: `${fileType === 'resume' ? 'Resume' : 'Job Description'} uploaded successfully`,
      data: {
        document: {
          id: document._id,
          fileName: document.fileName,
          fileType: document.fileType,
          uploadedAt: document.uploadedAt
        }
      }
    });
  } catch (error) {
    // Clean up file if exists
    if (req.file) {
      cleanupFile(req.file.path);
    }
    
    console.error('Upload error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error uploading document',
      error: error.message
    });
  }
};


export const listDocuments = async (req, res) => {
  try {
    const documents = await Document.find({ userId: req.user._id })
      .select('-extractedText -embeddings')
      .sort('-uploadedAt');

    res.status(200).json({
      status: 'success',
      data: {
        documents: documents.map(doc => ({
          id: doc._id,
          fileName: doc.fileName,
          fileType: doc.fileType,
          fileUrl: doc.fileUrl,
          uploadedAt: doc.uploadedAt
        }))
      }
    });
  } catch (error) {
    console.error('List documents error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching documents',
      error: error.message
    });
  }
};


export const deleteDocument = async (req, res) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!document) {
      return res.status(404).json({
        status: 'error',
        message: 'Document not found'
      });
    }

    // Delete from Cloudinary
    await cloudinary.uploader.destroy(document.cloudinaryPublicId);

    // Delete from database
    await document.deleteOne();

    res.status(200).json({
      status: 'success',
      message: 'Document deleted successfully'
    });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error deleting document',
      error: error.message
    });
  }
};
