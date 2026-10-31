import { Router } from 'express';
import * as authController from '../controllers/authController';
import { requireAuth } from '../middleware/auth';
import { loginRateLimiter } from '../middleware/rateLimit';

const router = Router();

router.post('/login', loginRateLimiter, authController.login);
router.post('/guest-demo', authController.guestDemo);
router.get('/me', requireAuth, authController.me);
router.post('/logout', (req, res, next) => {
  // Optional auth header handling for logout
  const header = req.get('authorization') || '';
  if (header.startsWith('Bearer ')) {
    return requireAuth(req, res, () => authController.logout(req, res));
  }
  return authController.logout(req, res);
});

export default router;
