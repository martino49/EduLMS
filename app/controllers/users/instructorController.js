const { pool: db } = require('../../../config/database');
const Instructor = require('../../models/Instructor');
const { asyncHandler } = require('../../middleware/errorHandler');

module.exports = {
  // Instructor Dashboard
  dashboard: asyncHandler(async (req, res) => {
    try {
      const instructorId = req.user.id;

      const [profile, recentSubmissions, coursesForGrading] = await Promise.all([
        Instructor.getProfile(instructorId),
        db.query(`
          SELECT s.*, u.name as student_name, a.title as assignment_title, c.title as course_title
          FROM submissions s
          JOIN users u ON s.student_id = u.id
          JOIN assignments a ON s.assignment_id = a.id
          JOIN courses c ON a.course_id = c.id
          WHERE c.teacher_id = ?
          ORDER BY s.submitted_at DESC
          LIMIT 5
        `, [instructorId]),
        Instructor.getAssignmentsForGrading(instructorId, 1, 5)
      ]);

      res.render('instructor/dashboard', {
        title: 'Instructor Dashboard - EduLMS',
        layout: 'layouts/instructor-layout',
        currentUser: req.user,
        currentPage: 'dashboard',
        profile,
        recentSubmissions,
        coursesForGrading: coursesForGrading.assignments || []
      });
    } catch (error) {
      console.error('Instructor dashboard error:', error);
      req.flash('error_msg', 'Error loading dashboard');
      res.redirect('/');
    }
  }),

  // Course Management
  listCourses: asyncHandler(async (req, res) => {
    try {
      const instructorId = req.user.id;
      const page = parseInt(req.query.page) || 1;
      const limit = 10;

      const coursesData = await Instructor.getCourses(instructorId, req.query, page, limit);

      res.render('instructor/courses/list', {
        title: 'My Courses - EduLMS',
        layout: 'layouts/instructor-layout',
        currentUser: req.user,
        currentPage: 'courses',
        ...coursesData
      });
    } catch (error) {
      console.error('List courses error:', error);
      req.flash('error_msg', 'Error loading courses');
      res.redirect('/instructor/dashboard');
    }
  }),

  showCreateCourse: asyncHandler(async (req, res) => {
    res.render('instructor/courses/create', {
      title: 'Create Course - EduLMS',
      layout: 'layouts/instructor-layout',
      currentUser: req.user,
      currentPage: 'courses',
      pageTitle: 'Create New Course',
      breadcrumbs: [
        { title: 'Courses', url: '/instructor/courses' },
        { title: 'Create', url: '/instructor/courses/create', active: true }
      ]
    });
  }),

  createCourse: asyncHandler(async (req, res) => {
    try {
      const courseId = await Instructor.createCourse({
        ...req.body,
        teacher_id: req.user.id,
        course_code: req.body.code // Validator uses 'code', DB uses 'course_code'
      });

      req.flash('success_msg', 'Course created successfully and is pending approval.');
      res.redirect(`/instructor/courses/${courseId}`);
    } catch (error) {
      console.error('Create course error:', error);
      req.flash('error_msg', 'Error creating course: ' + error.message);
      res.redirect('/instructor/courses/create');
    }
  }),

  viewCourse: asyncHandler(async (req, res) => {
    try {
      const { courseId } = req.params;
      const instructorId = req.user.id;

      const [courseResult, studentsData, materials, assignments] = await Promise.all([
        db.query(`
          SELECT c.*, COUNT(DISTINCT e.id) as student_count
          FROM courses c
          LEFT JOIN enrollments e ON c.id = e.course_id AND e.status = 'active'
          WHERE c.id = ? AND c.teacher_id = ?
          GROUP BY c.id
        `, [courseId, instructorId]),
        Instructor.getCourseStudents(courseId, instructorId),
        db.query('SELECT * FROM course_materials WHERE course_id = ?', [courseId]),
        db.query('SELECT * FROM assignments WHERE course_id = ?', [courseId])
      ]);

      if (courseResult.length === 0) {
        req.flash('error_msg', 'Course not found or access denied');
        return res.redirect('/instructor/courses');
      }

      res.render('instructor/courses/view', {
        title: `${courseResult[0].title} - EduLMS`,
        layout: 'layouts/instructor-layout',
        currentUser: req.user,
        currentPage: 'courses',
        course: courseResult[0],
        students: studentsData.students,
        materials,
        assignments,
        pageTitle: 'Course Details',
        breadcrumbs: [
          { title: 'Courses', url: '/instructor/courses' },
          { title: courseResult[0].course_code, url: `/instructor/courses/${courseId}`, active: true }
        ]
      });
    } catch (error) {
      console.error('View course error:', error);
      req.flash('error_msg', 'Error loading course details');
      res.redirect('/instructor/courses');
    }
  }),

  showEditCourse: asyncHandler(async (req, res) => {
    try {
      const { courseId } = req.params;
      const instructorId = req.user.id;

      const [course] = await db.query('SELECT * FROM courses WHERE id = ? AND teacher_id = ?', [courseId, instructorId]);

      if (course.length === 0) {
        req.flash('error_msg', 'Course not found or access denied');
        return res.redirect('/instructor/courses');
      }

      res.render('instructor/courses/edit', {
        title: `Edit Course - ${course[0].title}`,
        layout: 'layouts/instructor-layout',
        currentUser: req.user,
        currentPage: 'courses',
        course: course[0],
        pageTitle: 'Edit Course',
        breadcrumbs: [
          { title: 'Courses', url: '/instructor/courses' },
          { title: course[0].course_code, url: `/instructor/courses/${courseId}` },
          { title: 'Edit', url: `/instructor/courses/${courseId}/edit`, active: true }
        ]
      });
    } catch (error) {
      console.error('Show edit course error:', error);
      req.flash('error_msg', 'Error loading course for editing');
      res.redirect('/instructor/courses');
    }
  }),

  updateCourse: asyncHandler(async (req, res) => {
    try {
      const { courseId } = req.params;
      const instructorId = req.user.id;

      const updated = await Instructor.updateCourse(courseId, {
        ...req.body,
        course_code: req.body.code // If code changed
      });

      if (!updated) {
        req.flash('error_msg', 'Course not found or no changes made');
      } else {
        req.flash('success_msg', 'Course updated successfully');
      }
      res.redirect(`/instructor/courses/${courseId}`);
    } catch (error) {
      console.error('Update course error:', error);
      req.flash('error_msg', 'Error updating course: ' + error.message);
      res.redirect(`/instructor/courses/${req.params.courseId}/edit`);
    }
  }),

  updateCourseStatus: asyncHandler(async (req, res) => {
    res.json({ message: 'Update course status - Under construction' });
  }),

  courseStudents: asyncHandler(async (req, res) => {
    try {
      const { courseId } = req.params;
      const instructorId = req.user.id;

      const studentsData = await Instructor.getCourseStudents(courseId, instructorId);

      res.render('instructor/courses/students', {
        title: `Students - ${studentsData.course.title}`,
        layout: 'layouts/instructor-layout',
        currentUser: req.user,
        currentPage: 'courses',
        course: studentsData.course,
        students: studentsData.students,
        pageTitle: 'Enrolled Students',
        breadcrumbs: [
          { title: 'Courses', url: '/instructor/courses' },
          { title: studentsData.course.course_code || 'Course', url: `/instructor/courses/${courseId}` },
          { title: 'Students', url: `/instructor/courses/${courseId}/students`, active: true }
        ]
      });
    } catch (error) {
      console.error('Course students error:', error);
      req.flash('error_msg', error.message || 'Error loading students');
      res.redirect('/instructor/courses');
    }
  }),

  courseMaterials: asyncHandler(async (req, res) => {
    try {
      const { courseId } = req.params;
      const instructorId = req.user.id;

      const [course, materials] = await Promise.all([
        db.query('SELECT id, title, course_code FROM courses WHERE id = ? AND teacher_id = ?', [courseId, instructorId]),
        db.query('SELECT * FROM course_materials WHERE course_id = ? ORDER BY created_at DESC', [courseId])
      ]);

      if (course.length === 0) {
        req.flash('error_msg', 'Course not found or access denied');
        return res.redirect('/instructor/courses');
      }

      res.render('instructor/courses/materials', {
        title: `Materials - ${course[0].title}`,
        layout: 'layouts/instructor-layout',
        currentUser: req.user,
        currentPage: 'courses',
        course: course[0],
        materials,
        pageTitle: 'Course Materials',
        breadcrumbs: [
          { title: 'Courses', url: '/instructor/courses' },
          { title: course[0].course_code, url: `/instructor/courses/${courseId}` },
          { title: 'Materials', url: `/instructor/courses/${courseId}/materials`, active: true }
        ]
      });
    } catch (error) {
      console.error('Course materials error:', error);
      req.flash('error_msg', 'Error loading materials');
      res.redirect('/instructor/courses');
    }
  }),

  uploadCourseMaterial: asyncHandler(async (req, res) => {
    res.json({ message: 'Upload course material - Under construction' });
  }),

  // Assignment Management
  listAssignments: asyncHandler(async (req, res) => {
    try {
      const instructorId = req.user.id;
      const page = parseInt(req.query.page) || 1;
      const limit = 10;

      const assignmentsData = await db.query(`
        SELECT a.*, c.title as course_title, c.course_code
        FROM assignments a
        JOIN courses c ON a.course_id = c.id
        WHERE c.teacher_id = ?
        ORDER BY a.created_at DESC
        LIMIT ? OFFSET ?
      `, [instructorId, limit, (page - 1) * limit]);

      res.render('instructor/assignments/list', {
        title: 'Assignments - EduLMS',
        layout: 'layouts/instructor-layout',
        currentUser: req.user,
        currentPage: 'assignments',
        assignments: assignmentsData,
        pagination: { current: page, totalPages: 1 } // Simplified for now
      });
    } catch (error) {
      console.error('List assignments error:', error);
      req.flash('error_msg', 'Error loading assignments');
      res.redirect('/instructor/dashboard');
    }
  }),

  showCreateAssignment: asyncHandler(async (req, res) => {
    try {
      const instructorId = req.user.id;
      const courses = await db.query('SELECT id, title, course_code FROM courses WHERE teacher_id = ?', [instructorId]);

      res.render('instructor/assignments/create', {
        title: 'Create Assignment - EduLMS',
        layout: 'layouts/instructor-layout',
        currentUser: req.user,
        currentPage: 'assignments',
        courses,
        selectedCourseId: req.query.courseId,
        pageTitle: 'Create New Assignment',
        breadcrumbs: [
          { title: 'Assignments', url: '/instructor/assignments' },
          { title: 'Create', url: '/instructor/assignments/create', active: true }
        ]
      });
    } catch (error) {
      console.error('Show create assignment error:', error);
      req.flash('error_msg', 'Error loading courses for assignment');
      res.redirect('/instructor/assignments');
    }
  }),

  createAssignment: asyncHandler(async (req, res) => {
    try {
      const assignmentId = await Instructor.createAssignment({
        ...req.body,
        teacher_id: req.user.id
      });

      req.flash('success_msg', 'Assignment created successfully');
      res.redirect(`/instructor/assignments/${assignmentId}`);
    } catch (error) {
      console.error('Create assignment error:', error);
      req.flash('error_msg', 'Error creating assignment: ' + error.message);
      res.redirect('/instructor/assignments/create');
    }
  }),

  viewAssignment: asyncHandler(async (req, res) => {
    try {
      const { assignmentId } = req.params;
      const instructorId = req.user.id;

      const [assignmentResult] = await db.query(`
        SELECT a.*, c.title as course_title, c.course_code
        FROM assignments a
        JOIN courses c ON a.course_id = c.id
        WHERE a.id = ? AND c.teacher_id = ?
      `, [assignmentId, instructorId]);

      if (assignmentResult.length === 0) {
        req.flash('error_msg', 'Assignment not found or access denied');
        return res.redirect('/instructor/assignments');
      }

      const submissions = await Instructor.getAssignmentSubmissions(assignmentId);

      res.render('instructor/assignments/view', {
        title: `${assignmentResult[0].title} - EduLMS`,
        layout: 'layouts/instructor-layout',
        currentUser: req.user,
        currentPage: 'assignments',
        assignment: assignmentResult[0],
        submissions: submissions.submissions || [],
        pageTitle: 'Assignment Details',
        breadcrumbs: [
          { title: 'Assignments', url: '/instructor/assignments' },
          { title: assignmentResult[0].title, url: `/instructor/assignments/${assignmentId}`, active: true }
        ]
      });
    } catch (error) {
      console.error('View assignment error:', error);
      req.flash('error_msg', 'Error loading assignment details');
      res.redirect('/instructor/assignments');
    }
  }),

  showEditAssignment: asyncHandler(async (req, res) => {
    try {
      const { assignmentId } = req.params;
      const instructorId = req.user.id;

      const [assignmentResult] = await db.query(`
        SELECT a.*, c.title as course_title, c.course_code
        FROM assignments a
        JOIN courses c ON a.course_id = c.id
        WHERE a.id = ? AND c.teacher_id = ?
      `, [assignmentId, instructorId]);

      if (assignmentResult.length === 0) {
        req.flash('error_msg', 'Assignment not found or access denied');
        return res.redirect('/instructor/assignments');
      }

      const courses = await db.query('SELECT id, title, course_code FROM courses WHERE teacher_id = ?', [instructorId]);

      res.render('instructor/assignments/edit', {
        title: `Edit Assignment - ${assignmentResult[0].title}`,
        layout: 'layouts/instructor-layout',
        currentUser: req.user,
        currentPage: 'assignments',
        assignment: assignmentResult[0],
        courses,
        pageTitle: 'Edit Assignment',
        breadcrumbs: [
          { title: 'Assignments', url: '/instructor/assignments' },
          { title: assignmentResult[0].title, url: `/instructor/assignments/${assignmentId}` },
          { title: 'Edit', url: `/instructor/assignments/${assignmentId}/edit`, active: true }
        ]
      });
    } catch (error) {
      console.error('Show edit assignment error:', error);
      req.flash('error_msg', 'Error loading assignment for editing');
      res.redirect('/instructor/assignments');
    }
  }),

  updateAssignment: asyncHandler(async (req, res) => {
    try {
      const { assignmentId } = req.params;
      const instructorId = req.user.id;

      const updated = await Instructor.updateAssignment(assignmentId, req.body);

      if (!updated) {
        req.flash('error_msg', 'Assignment not found or no changes made');
      } else {
        req.flash('success_msg', 'Assignment updated successfully');
      }
      res.redirect(`/instructor/assignments/${assignmentId}`);
    } catch (error) {
      console.error('Update assignment error:', error);
      req.flash('error_msg', 'Error updating assignment: ' + error.message);
      res.redirect(`/instructor/assignments/${req.params.assignmentId}/edit`);
    }
  }),

  updateAssignmentStatus: asyncHandler(async (req, res) => {
    res.json({ message: 'Update assignment status - Under construction' });
  }),

  deleteAssignment: asyncHandler(async (req, res) => {
    res.json({ message: 'Delete assignment - Under construction' });
  }),

  // All other methods with basic implementation
  listSubmissions: asyncHandler(async (req, res) => {
    res.json({ message: 'List submissions - Under construction' });
  }),

  assignmentSubmissions: asyncHandler(async (req, res) => {
    res.json({ message: 'Assignment submissions - Under construction' });
  }),

  viewSubmission: asyncHandler(async (req, res) => {
    res.json({ message: 'View submission - Under construction' });
  }),

  showGradeSubmission: asyncHandler(async (req, res) => {
    try {
      const { submissionId } = req.params;
      const instructorId = req.user.id;

      const submission = await Instructor.getSubmission(submissionId);

      if (!submission) {
        req.flash('error_msg', 'Submission not found');
        return res.redirect('/instructor/submissions');
      }

      // Verify instructor owns the course
      const [course] = await db.query('SELECT teacher_id FROM courses WHERE id = ?', [submission.course_id]);
      if (course.length === 0 || course[0].teacher_id !== instructorId) {
        req.flash('error_msg', 'Access denied');
        return res.redirect('/instructor/submissions');
      }

      res.render('instructor/assignments/grade', {
        title: 'Grade Submission - EduLMS',
        layout: 'layouts/instructor-layout',
        currentUser: req.user,
        currentPage: 'submissions',
        submission,
        pageTitle: 'Grade Assignment',
        breadcrumbs: [
          { title: 'Submissions', url: '/instructor/submissions' },
          { title: 'Grading', url: `/instructor/submissions/${submissionId}/grade`, active: true }
        ]
      });
    } catch (error) {
      console.error('Show grade submission error:', error);
      req.flash('error_msg', 'Error loading submission for grading');
      res.redirect('/instructor/submissions');
    }
  }),

  gradeSubmission: asyncHandler(async (req, res) => {
    try {
      const { submissionId } = req.params;
      const instructorId = req.user.id;
      const { grade, feedback } = req.body;

      await Instructor.gradeSubmission(submissionId, {
        grade,
        feedback,
        graded_by: instructorId
      });

      req.flash('success_msg', 'Submission graded successfully');
      res.redirect(`/instructor/submissions`);
    } catch (error) {
      console.error('Grade submission error:', error);
      req.flash('error_msg', 'Error grading submission: ' + error.message);
      res.redirect(`/instructor/submissions/${req.params.submissionId}/grade`);
    }
  }),

  bulkGradeSubmissions: asyncHandler(async (req, res) => {
    res.json({ message: 'Bulk grade submissions - Under construction' });
  }),

  downloadSubmission: asyncHandler(async (req, res) => {
    res.json({ message: 'Download submission - Under construction' });
  }),

  manageGrades: asyncHandler(async (req, res) => {
    res.json({ message: 'Manage grades - Under construction' });
  }),

  showGradeEntry: asyncHandler(async (req, res) => {
    res.json({ message: 'Show grade entry form - Under construction' });
  }),

  enterGrade: asyncHandler(async (req, res) => {
    res.json({ message: 'Enter grade - Under construction' });
  }),

  gradeReport: asyncHandler(async (req, res) => {
    res.json({ message: 'Grade report - Under construction' });
  }),

  generateGradePDF: asyncHandler(async (req, res) => {
    res.json({ message: 'Generate grade PDF - Under construction' });
  }),

  gradebook: asyncHandler(async (req, res) => {
    res.json({ message: 'Gradebook - Under construction' });
  }),

  showTakeAttendance: asyncHandler(async (req, res) => {
    res.json({ message: 'Show take attendance form - Under construction' });
  }),

  takeAttendance: asyncHandler(async (req, res) => {
    res.json({ message: 'Take attendance - Under construction' });
  }),

  viewAttendance: asyncHandler(async (req, res) => {
    res.json({ message: 'View attendance - Under construction' });
  }),

  attendanceReports: asyncHandler(async (req, res) => {
    res.json({ message: 'Attendance reports - Under construction' });
  }),

  viewProfile: asyncHandler(async (req, res) => {
    try {
      const instructorId = req.user.id;
      const profile = await Instructor.getProfile(instructorId);

      res.render('instructor/profile/view', {
        title: 'My Profile - EduLMS',
        layout: 'layouts/instructor-layout',
        currentUser: req.user,
        currentPage: 'profile',
        profile,
        pageTitle: 'Instructor Profile',
        breadcrumbs: [
          { title: 'Profile', url: '/instructor/profile', active: true }
        ]
      });
    } catch (error) {
      console.error('View profile error:', error);
      req.flash('error_msg', 'Error loading profile');
      res.redirect('/instructor/dashboard');
    }
  }),

  showEditProfile: asyncHandler(async (req, res) => {
    try {
      const instructorId = req.user.id;
      const profile = await Instructor.getProfile(instructorId);

      res.render('instructor/profile/edit', {
        title: 'Edit Profile - EduLMS',
        layout: 'layouts/instructor-layout',
        currentUser: req.user,
        currentPage: 'profile',
        profile,
        pageTitle: 'Edit My Profile',
        breadcrumbs: [
          { title: 'Profile', url: '/instructor/profile' },
          { title: 'Edit', url: '/instructor/profile/edit', active: true }
        ]
      });
    } catch (error) {
      console.error('Show edit profile error:', error);
      req.flash('error_msg', 'Error loading profile for editing');
      res.redirect('/instructor/profile');
    }
  }),

  updateProfile: asyncHandler(async (req, res) => {
    try {
      const instructorId = req.user.id;
      const { name, email, phone, bio } = req.body;

      await db.query(`
        UPDATE users SET name = ?, email = ?, phone = ?, bio = ?
        WHERE id = ?
      `, [name, email, phone, bio, instructorId]);

      req.flash('success_msg', 'Profile updated successfully');
      res.redirect('/instructor/profile');
    } catch (error) {
      console.error('Update profile error:', error);
      req.flash('error_msg', 'Error updating profile: ' + error.message);
      res.redirect('/instructor/profile/edit');
    }
  }),

  listNotifications: asyncHandler(async (req, res) => {
    try {
      const instructorId = req.user.id;
      const [notifications] = await db.query(
        'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC',
        [instructorId]
      );

      res.render('instructor/notifications/list', {
        title: 'Notifications - EduLMS',
        layout: 'layouts/instructor-layout',
        currentUser: req.user,
        currentPage: 'notifications',
        notifications,
        pageTitle: 'My Notifications',
        breadcrumbs: [
          { title: 'Notifications', url: '/instructor/notifications', active: true }
        ]
      });
    } catch (error) {
      console.error('List notifications error:', error);
      req.flash('error_msg', 'Error loading notifications');
      res.redirect('/instructor/dashboard');
    }
  }),

  showCreateNotification: asyncHandler(async (req, res) => {
    try {
      const instructorId = req.user.id;
      const [courses] = await db.query('SELECT id, title, course_code FROM courses WHERE teacher_id = ?', [instructorId]);

      res.render('instructor/notifications/create', {
        title: 'Send Notification - EduLMS',
        layout: 'layouts/instructor-layout',
        currentUser: req.user,
        currentPage: 'notifications',
        courses,
        pageTitle: 'Compose Notification',
        breadcrumbs: [
          { title: 'Notifications', url: '/instructor/notifications' },
          { title: 'Compose', url: '/instructor/notifications/create', active: true }
        ]
      });
    } catch (error) {
      console.error('Show create notification error:', error);
      req.flash('error_msg', 'Error loading courses for notification');
      res.redirect('/instructor/notifications');
    }
  }),

  createNotification: asyncHandler(async (req, res) => {
    try {
      const { courseId, title, message, type } = req.body;
      const instructorId = req.user.id;

      // Get all students enrolled in the course
      const [students] = await db.query(
        'SELECT student_id FROM enrollments WHERE course_id = ? AND status = "active"',
        [courseId]
      );

      // Create notifications for each student
      const notificationPromises = students.map(student =>
        db.query(
          'INSERT INTO notifications (user_id, title, message, type, related_id, related_type) VALUES (?, ?, ?, ?, ?, ?)',
          [student.student_id, title, message, type || 'info', courseId, 'course']
        )
      );

      await Promise.all(notificationPromises);

      req.flash('success_msg', `Notification sent to ${students.length} students`);
      res.redirect('/instructor/notifications');
    } catch (error) {
      console.error('Create notification error:', error);
      req.flash('error_msg', 'Error sending notification');
      res.redirect('/instructor/notifications/create');
    }
  }),

  viewNotification: asyncHandler(async (req, res) => {
    try {
      const { notificationId } = req.params;
      const instructorId = req.user.id;

      const [notifications] = await db.query(
        'SELECT * FROM notifications WHERE id = ? AND user_id = ?',
        [notificationId, instructorId]
      );

      if (notifications.length === 0) {
        req.flash('error_msg', 'Notification not found');
        return res.redirect('/instructor/notifications');
      }

      // Mark as read
      await db.query('UPDATE notifications SET status = "read" WHERE id = ?', [notificationId]);

      res.render('instructor/notifications/view', {
        title: 'View Notification - EduLMS',
        layout: 'layouts/instructor-layout',
        currentUser: req.user,
        currentPage: 'notifications',
        notification: notifications[0],
        pageTitle: 'Notification Details',
        breadcrumbs: [
          { title: 'Notifications', url: '/instructor/notifications' },
          { title: 'View', url: `/instructor/notifications/${notificationId}`, active: true }
        ]
      });
    } catch (error) {
      console.error('View notification error:', error);
      req.flash('error_msg', 'Error loading notification');
      res.redirect('/instructor/notifications');
    }
  }),

  showGradebook: asyncHandler(async (req, res) => {
    try {
      const instructorId = req.user.id;
      const { courseId } = req.query;

      const [courses] = await db.query('SELECT id, title, course_code FROM courses WHERE teacher_id = ?', [instructorId]);

      let selectedCourse = null;
      let students = [];
      let assignments = [];
      let gradeData = {};

      if (courseId) {
        selectedCourse = courses.find(c => c.id == courseId);
        if (selectedCourse) {
          [students] = await db.query(`
            SELECT u.id, u.name
            FROM users u
            JOIN enrollments e ON u.id = e.student_id
            WHERE e.course_id = ? AND e.status = 'active'
          `, [courseId]);

          [assignments] = await db.query(`
            SELECT id, title, max_points
            FROM assignments
            WHERE course_id = ?
            ORDER BY due_date ASC
          `, [courseId]);

          const [submissions] = await db.query(`
            SELECT s.student_id, s.assignment_id, s.grade
            FROM submissions s
            JOIN assignments a ON s.assignment_id = a.id
            WHERE a.course_id = ?
          `, [courseId]);

          submissions.forEach(s => {
            if (!gradeData[s.student_id]) gradeData[s.student_id] = {};
            gradeData[s.student_id][s.assignment_id] = s.grade;
          });
        }
      }

      res.render('instructor/grades/gradebook', {
        title: 'Gradebook - EduLMS',
        layout: 'layouts/instructor-layout',
        currentUser: req.user,
        currentPage: 'gradebook',
        courses,
        selectedCourse,
        students,
        assignments,
        gradeData,
        pageTitle: 'Course Gradebook',
        breadcrumbs: [
          { title: 'Gradebook', url: '/instructor/gradebook', active: true }
        ]
      });
    } catch (error) {
      console.error('Gradebook error:', error);
      req.flash('error_msg', 'Error loading gradebook');
      res.redirect('/instructor/dashboard');
    }
  }),

  showAnalytics: asyncHandler(async (req, res) => {
    try {
      const instructorId = req.user.id;

      // Basic stats for analytics dashboard
      const [stats] = await db.query(`
        SELECT 
          (SELECT COUNT(*) FROM courses WHERE teacher_id = ?) as total_courses,
          (SELECT COUNT(*) FROM enrollments e JOIN courses c ON e.course_id = c.id WHERE c.teacher_id = ?) as total_enrolled,
          (SELECT COUNT(*) FROM assignments a JOIN courses c ON a.course_id = c.id WHERE c.teacher_id = ?) as total_assignments,
          (SELECT COUNT(*) FROM submissions s JOIN assignments a ON s.assignment_id = a.id JOIN courses c ON a.course_id = c.id WHERE c.teacher_id = ?) as total_submissions
      `, [instructorId, instructorId, instructorId, instructorId]);

      // Grade distribution
      const [grades] = await db.query(`
        SELECT 
          CASE 
            WHEN grade/a.max_points >= 0.9 THEN 'A'
            WHEN grade/a.max_points >= 0.8 THEN 'B'
            WHEN grade/a.max_points >= 0.7 THEN 'C'
            WHEN grade/a.max_points >= 0.6 THEN 'D'
            ELSE 'F'
          END as letter_grade,
          COUNT(*) as count
        FROM submissions s
        JOIN assignments a ON s.assignment_id = a.id
        JOIN courses c ON a.course_id = c.id
        WHERE c.teacher_id = ? AND s.grade IS NOT NULL
        GROUP BY letter_grade
      `, [instructorId]);

      res.render('instructor/analytics', {
        title: 'Analytics - EduLMS',
        layout: 'layouts/instructor-layout',
        currentUser: req.user,
        currentPage: 'analytics',
        stats: stats[0],
        grades,
        pageTitle: 'Performance Analytics',
        breadcrumbs: [
          { title: 'Analytics', url: '/instructor/analytics', active: true }
        ]
      });
    } catch (error) {
      console.error('Analytics error:', error);
      req.flash('error_msg', 'Error loading analytics');
      res.redirect('/instructor/dashboard');
    }
  }),

  studentAnalytics: asyncHandler(async (req, res) => {
    res.json({ message: 'Student analytics - Under construction' });
  }),

  performanceAnalytics: asyncHandler(async (req, res) => {
    res.json({ message: 'Performance analytics - Under construction' });
  }),

  getCourseStats: asyncHandler(async (req, res) => {
    res.json({ message: 'Get course stats - Under construction' });
  }),

  getAssignmentStats: asyncHandler(async (req, res) => {
    res.json({ message: 'Get assignment stats - Under construction' });
  }),

  getStudentPerformance: asyncHandler(async (req, res) => {
    res.json({ message: 'Get student performance - Under construction' });
  }),

  getPendingSubmissions: asyncHandler(async (req, res) => {
    res.json({ message: 'Get pending submissions - Under construction' });
  }),

  uploadMaterial: asyncHandler(async (req, res) => {
    res.json({ message: 'Upload material - Under construction' });
  }),

  downloadTemplate: asyncHandler(async (req, res) => {
    res.json({ message: 'Download template - Under construction' });
  }),

  uploadGrades: asyncHandler(async (req, res) => {
    res.json({ message: 'Upload grades - Under construction' });
  }),

  studentCommunication: asyncHandler(async (req, res) => {
    res.json({ message: 'Student communication - Under construction' });
  }),

  sendMessageToStudents: asyncHandler(async (req, res) => {
    res.json({ message: 'Send message to students - Under construction' });
  }),

  // Missing methods from instructor.js
  bulkGradeSubmissions: asyncHandler(async (req, res) => {
    res.json({ message: 'Bulk grade submissions - Under construction' });
  }),

  downloadSubmission: asyncHandler(async (req, res) => {
    res.json({ message: 'Download submission - Under construction' });
  }),

  manageGrades: asyncHandler(async (req, res) => {
    res.json({ message: 'Manage grades - Under construction' });
  }),

  gradebook: asyncHandler(async (req, res) => {
    const { courseId } = req.params;
    res.redirect(`/instructor/gradebook?courseId=${courseId}`);
  }),

  showTakeAttendance: asyncHandler(async (req, res) => {
    res.json({ message: 'Show take attendance - Under construction' });
  }),

  takeAttendance: asyncHandler(async (req, res) => {
    res.json({ message: 'Take attendance - Under construction' });
  }),

  viewAttendance: asyncHandler(async (req, res) => {
    res.json({ message: 'View attendance - Under construction' });
  }),

  attendanceReports: asyncHandler(async (req, res) => {
    res.json({ message: 'Attendance reports - Under construction' });
  }),

  courseAnalytics: asyncHandler(async (req, res) => {
    const { courseId } = req.params;
    res.json({ message: `Course analytics for ${courseId} - Under construction` });
  })
};