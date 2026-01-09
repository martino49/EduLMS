// middleware/locals.js
const { ROLES } = require('../../config/constants');

module.exports = function (req, res, next) {
  // 1. User Auth Data
  res.locals.user = req.user || null;
  res.locals.currentUser = req.user || null;

  // 2. Flash Messages (Unified)
  res.locals.success_msg = req.flash ? req.flash('success_msg') : [];
  res.locals.error_msg = req.flash ? req.flash('error_msg') : [];
  res.locals.error = req.flash ? req.flash('error') : [];

  res.locals.messages = {
    success: res.locals.success_msg,
    error: res.locals.error_msg,
    warning: req.flash ? req.flash('warning') : [],
    info: req.flash ? req.flash('info') : []
  };

  res.locals.oldInput = req.flash ? (req.flash('oldInput')[0] || {}) : {};

  // 3. View State & Metadata
  res.locals.currentPath = req.path;
  res.locals.currentPage = '';
  res.locals.pageTitle = '';
  res.locals.title = res.locals.pageTitle || 'EduLMS';
  res.locals.pageStyles = [];
  res.locals.pageScripts = [];
  res.locals.breadcrumbs = [];
  res.locals.headerActions = [];
  res.locals.unreadNotifications = 0;

  // 4. App Info
  res.locals.app_name = process.env.SITE_NAME || 'EduLMS';
  res.locals.currentYear = new Date().getFullYear();
  res.locals.app_version = process.env.APP_VERSION || '1.0.0';
  res.locals.app_env = process.env.NODE_ENV || 'development';

  // 5. Cache Control for Auth Routes (Prevent "White Page Cache")
  if (req.path.startsWith('/auth')) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }

  // 6. Automatic Layout Selection based on Role
  if (req.user && req.user.role_name) {
    const role = req.user.role_name.toLowerCase();
    switch (role) {
      case ROLES.ADMIN:
        res.locals.layout = 'layouts/admin-layout';
        break;
      case ROLES.STUDENT:
        res.locals.layout = 'layouts/student-layout';
        break;
      case ROLES.INSTRUCTOR:
        res.locals.layout = 'layouts/instructor-layout';
        break;
      case ROLES.FINANCE_OFFICER:
        res.locals.layout = 'layouts/finance-layout';
        break;
      default:
        res.locals.layout = 'layouts/layout';
    }
  } else {
    res.locals.layout = 'layouts/layout';
  }

  next();
};