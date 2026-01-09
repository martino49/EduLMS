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
router.get('/courses/enroll', studentController.showAvailableCourses);
router.get('/courses/:courseId', studentController.viewCourse);
router.post('/courses/:courseId/enroll', studentController.enrollInCourse);

// Assignment routes  
router.get('/assignments', studentController.getAssignments);
router.get('/assignments/:assignmentId', studentController.viewAssignment);
router.post('/assignments/:assignmentId/submit', studentController.submitAssignment);

// Grade routes
router.get('/grades', studentController.getGrades);

// Payment routes
router.get('/payments', studentController.getPayments);
router.get('/payments/make', studentController.showMakePayment);
router.post('/payments/pay', studentController.handlePayment);

// Profile routes
router.get('/profile', studentController.viewProfile);
router.get('/profile/edit', studentController.showEditProfile);
router.post('/profile/edit', studentController.updateProfile);

// Notification routes
router.get('/notifications', studentController.getNotifications);
router.post('/notifications/:notificationId/read', studentController.markNotificationAsRead);

module.exports = router;