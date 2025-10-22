import express from 'express';
import { uploadDocument, listDocuments, deleteDocument, upload } from '../controllers/document.controller.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.post('/upload', protect, upload.single('file'), uploadDocument);
router.get('/list', protect, listDocuments);
router.delete('/:id', protect, deleteDocument);

export default router;
