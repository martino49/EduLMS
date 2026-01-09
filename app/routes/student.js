const express = require('express');
const router = express.Router();

const { isAuthenticated, hasRole } = require('../middleware/auth');
const studentController = require('../controllers/users/studentController');

// Apply student auth middleware to all routes
router.use(isAuthenticated);
router.use(hasRole('student'));

// Dashboard
router.get('/dashboard', studentController.dashboard);

// Course routes
router.get('/courses', studentController.getCourses);

// Assignment routes  
router.get('/assignments', studentController.getAssignments);
router.post('/assignments/:assignmentId/submit', studentController.submitAssignment);

// Grade routes
router.get('/grades', studentController.getGrades);

// Notification routes
router.post('/notifications/:notificationId/read', studentController.markNotificationAsRead);

module.exports = router;