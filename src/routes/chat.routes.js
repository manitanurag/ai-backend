import express from 'express';
import { startChat, queryChat, getChatHistory, getChatSessions } from '../controllers/chat.controller.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.post('/start', protect, startChat);
router.post('/query', protect, queryChat);
router.get('/sessions', protect, getChatSessions);
router.get('/:chatId', protect, getChatHistory);

export default router;
