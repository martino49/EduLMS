// middleware/locals.js
module.exports = function (req, res, next) {
  // Make currentUser available to all views
  res.locals.currentUser = req.user || null;

  // Default layout variables to prevent ReferenceErrors
  res.locals.currentPage = '';
  res.locals.pageStyles = [];
  res.locals.pageScripts = [];
  res.locals.breadcrumbs = [];
  res.locals.pageTitle = '';
  res.locals.headerActions = [];
  res.locals.messages = {
    success: req.flash ? req.flash('success') : [],
    error: req.flash ? req.flash('error') : [],
    warning: req.flash ? req.flash('warning') : [],
    info: req.flash ? req.flash('info') : []
  };

  next();
};