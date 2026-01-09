// middleware/locals.js
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
  res.locals.pageStyles = [];
  res.locals.pageScripts = [];
  res.locals.breadcrumbs = [];
  res.locals.headerActions = [];

  // 4. App Info
  res.locals.app_name = process.env.SITE_NAME || 'EduLMS';
  res.locals.currentYear = new Date().getFullYear();
  res.locals.app_version = process.env.APP_VERSION || '1.0.0';
  res.locals.app_env = process.env.NODE_ENV || 'development';

  // 5. Automatic Layout Selection based on Role
  if (req.user) {
    switch (req.user.role_name) {
      case 'admin':
        res.locals.layout = 'layouts/admin-layout';
        break;
      case 'student':
        res.locals.layout = 'layouts/student-layout';
        break;
      case 'instructor':
        res.locals.layout = 'layouts/instructor-layout';
        break;
      case 'finance_officer':
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