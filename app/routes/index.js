const express = require('express');
const router = express.Router();
const { isAuthenticated, isNotAuthenticated } = require('../middleware/auth');

// Home route
router.get('/', (req, res) => {
  if (req.isAuthenticated()) {
    // Redirect to appropriate dashboard based on role
    switch (req.user.role_name) {
      case 'admin':
        return res.redirect('/admin/dashboard');
      case 'instructor':
        return res.redirect('/instructor/dashboard');
      case 'student':
        return res.redirect('/student/dashboard');
      case 'finance_officer':
        return res.redirect('/finance/dashboard');
      default:
        return res.redirect('/auth/login');
    }
  }
  res.render('index', {
    title: 'Welcome to EduLMS',
    layout: 'layouts/layout'
  });
});

// About page
router.get('/about', (req, res) => {
  res.render('about', {
    title: 'About Us - EduLMS',
    layout: 'layouts/layout'
  });
});

// Contact page
router.get('/contact', (req, res) => {
  res.render('contact', {
    title: 'Contact Us - EduLMS',
    layout: 'layouts/layout'
  });
});

// Features page
router.get('/features', (req, res) => {
  res.render('features', {
    title: 'Features - EduLMS',
    layout: 'layouts/layout'
  });
});

// Privacy policy
router.get('/privacy', (req, res) => {
  res.render('privacy', {
    title: 'Privacy Policy - EduLMS',
    layout: 'layouts/layout'
  });
});

// Terms of service
router.get('/terms', (req, res) => {
  res.render('terms', {
    title: 'Terms of Service - EduLMS',
    layout: 'layouts/layout'
  });
});

// Help Center
router.get('/help', (req, res) => {
  res.render('help', {
    title: 'Help Center - EduLMS',
    layout: 'layouts/layout'
  });
});

// Academic Programs
router.get('/programs', (req, res) => {
  res.render('programs', {
    title: 'Academic Programs - EduLMS',
    layout: 'layouts/layout'
  });
});

// Library
router.get('/library', (req, res) => {
  res.render('library', {
    title: 'Library - EduLMS',
    layout: 'layouts/layout'
  });
});

// Academic Calendar
router.get('/calendar', (req, res) => {
  res.render('calendar', {
    title: 'Academic Calendar - EduLMS',
    layout: 'layouts/layout'
  });
});

// Public Course Catalog
router.get('/courses', (req, res) => {
  res.render('courses_public', {
    title: 'Browse Courses - EduLMS',
    layout: 'layouts/layout'
  });
});

// System status
router.get('/status', (req, res) => {
  res.json({
    status: 'operational',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Dashboard redirect
router.get('/dashboard', isAuthenticated, (req, res) => {
  switch (req.user.role_name) {
    case 'admin':
      res.redirect('/admin/dashboard');
      break;
    case 'instructor':
      res.redirect('/instructor/dashboard');
      break;
    case 'student':
      res.redirect('/student/dashboard');
      break;
    case 'finance_officer':
      res.redirect('/finance/dashboard');
      break;
    default:
      res.redirect('/auth/login');
  }
});

module.exports = router;