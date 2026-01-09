const { pool: db } = require('../../../config/database');

// Add helpers for initials and data formatting
const Helpers = {
  generateInitials: (user) => {
    if (!user) return 'U';
    if (user.name) {
      const parts = user.name.split(' ');
      if (parts.length > 1) return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
      return user.name.charAt(0).toUpperCase();
    }
    if (user.username) return user.username.charAt(0).toUpperCase();
    if (user.email) return user.email.charAt(0).toUpperCase();
    return 'U';
  },

  formatDate: (date) => date ? new Date(date).toLocaleDateString() : '',

  // Calculate progress for a course (you'll need to implement this based on your logic)
  calculateCourseProgress: (courseId, studentId) => {
    // This is a placeholder - implement based on your progress tracking logic
    return Math.floor(Math.random() * 100); // Random progress for demo
  }
};

exports.dashboard = async (req, res) => {
  try {
    const studentId = req.user.id;

    // Generate user with initials
    const userWithInitials = {
      ...req.user,
      initials: Helpers.generateInitials(req.user)
    };

    // Parallelize database queries
    const [
      [enrolledCourses],
      [recentActivity],
      [upcomingDeadlines]
    ] = await Promise.all([
      // 1. Get enrolled courses
      db.query(`
        SELECT c.*, u.name as instructor_name,
               e.enrolled_at, e.status as enrollment_status
        FROM courses c
        JOIN enrollments e ON c.id = e.course_id
        JOIN users u ON c.teacher_id = u.id
        WHERE e.student_id = ? AND e.status = 'active'
        ORDER BY c.title ASC
      `, [studentId]),

      // 2. Get recent activity
      db.query(`
        (SELECT 
          'submission' as type,
          s.submitted_at as created_at,
          CONCAT('Submitted: ', a.title) as title,
          CONCAT('Assignment in ', c.title) as description,
          'paper-plane' as icon
        FROM submissions s
        JOIN assignments a ON s.assignment_id = a.id
        JOIN courses c ON a.course_id = c.id
        WHERE s.student_id = ?
        ORDER BY s.submitted_at DESC
        LIMIT 3)
        
        UNION ALL
        
        (SELECT 
          'grade' as type,
          g.graded_at as created_at,
          CONCAT('Grade received: ', a.title) as title,
          CONCAT('Score: ', g.points_earned, '/', a.max_points) as description,
          'chart-line' as icon
        FROM grades g
        JOIN submissions s ON g.submission_id = s.id
        JOIN assignments a ON g.assignment_id = a.id
        WHERE g.student_id = ?
        ORDER BY g.graded_at DESC
        LIMIT 3)
        
        UNION ALL
        
        (SELECT 
          'enrollment' as type,
          e.enrolled_at as created_at,
          CONCAT('Enrolled in: ', c.title) as title,
          'Course enrollment confirmed' as description,
          'book' as icon
        FROM enrollments e
        JOIN courses c ON e.course_id = c.id
        WHERE e.student_id = ? AND e.status = 'active'
        ORDER BY e.enrolled_at DESC
        LIMIT 2)
        
        ORDER BY created_at DESC
        LIMIT 8
      `, [studentId, studentId, studentId]),

      // 3. Get upcoming deadlines
      db.query(`
        SELECT a.*, c.title as course_name, c.course_code,
               a.due_date as due_date
        FROM assignments a
        JOIN courses c ON a.course_id = c.id
        JOIN enrollments e ON a.course_id = e.course_id
        WHERE e.student_id = ? AND e.status = 'active'
        AND a.status = 'published' 
        AND a.due_date > NOW()
        AND NOT EXISTS (
          SELECT 1 FROM submissions s 
          WHERE s.assignment_id = a.id AND s.student_id = ?
        )
        ORDER BY a.due_date ASC
        LIMIT 5
      `, [studentId, studentId])
    ]);

    // Format deadlines for template
    const formattedDeadlines = upcomingDeadlines.map(deadline => ({
      title: deadline.title,
      course: deadline.course_name,
      dueDate: Helpers.formatDate(deadline.due_date)
    }));

    // Calculate statistics
    const completedCourses = enrolledCourses.filter(course =>
      Helpers.calculateCourseProgress(course.id, studentId) === 100
    ).length;

    const averageProgress = enrolledCourses.length > 0
      ? Math.round(enrolledCourses.reduce((sum, course) =>
        sum + Helpers.calculateCourseProgress(course.id, studentId), 0) / enrolledCourses.length
      )
      : 0;

    // Get certificates count (placeholder - implement based on your logic)
    const certificatesCount = completedCourses;

    // Get achievements (placeholder - implement based on your achievements system)
    const achievements = [
      { title: 'First Course', icon: 'book' },
      { title: 'Perfect Score', icon: 'star' },
      { title: 'Quick Learner', icon: 'bolt' }
    ].slice(0, 3); // Just show first 3 for demo

    res.render('student/dashboard', {
      title: 'Student Dashboard - EduLMS',
      user: userWithInitials,
      enrolledCourses: coursesWithProgress,
      recentActivity: recentActivity,
      upcomingDeadlines: formattedDeadlines,
      stats: {
        enrolledCourses: enrolledCourses.length,
        completedCourses: completedCourses,
        averageProgress: averageProgress,
        certificates: certificatesCount
      },
      achievements: achievements
    });

  } catch (error) {
    console.error('Student dashboard error:', error);

    // Even on error, provide basic data to prevent template errors
    const userWithInitials = {
      ...req.user,
      initials: Helpers.generateInitials(req.user)
    };

    req.flash('error_msg', 'Error loading dashboard');
    res.render('student/dashboard', {
      title: 'Student Dashboard - EduLMS',
      user: userWithInitials,
      enrolledCourses: [],
      recentActivity: [],
      upcomingDeadlines: [],
      stats: {
        enrolledCourses: 0,
        completedCourses: 0,
        averageProgress: 0,
        certificates: 0
      },
      achievements: []
    });
  }
};

// Keep your existing methods but add initials support
exports.getAssignments = async (req, res) => {
  try {
    const studentId = req.user.id;

    const [assignments] = await db.query(`
      SELECT a.*, c.title as course_title, c.course_code,
             s.id as submission_id, s.submitted_at, s.status as submission_status,
             s.is_late, g.points_earned, g.grade, g.feedback
      FROM assignments a
      JOIN courses c ON a.course_id = c.id
      JOIN enrollments e ON c.id = e.course_id
      LEFT JOIN submissions s ON a.id = s.assignment_id AND s.student_id = ?
      LEFT JOIN grades g ON s.id = g.submission_id
      WHERE e.student_id = ? AND e.status = 'active'
      AND a.status = 'published'
      ORDER BY a.due_date ASC
    `, [studentId, studentId]);

    res.render('student/assignments/list', {
      title: 'My Assignments',
      user: {
        ...req.user,
        initials: Helpers.generateInitials(req.user)
      },
      assignments
    });

  } catch (error) {
    console.error('Get assignments error:', error);
    req.flash('error', 'Error loading assignments');
    res.redirect('/student/dashboard');
  }
};

exports.getCourses = async (req, res) => {
  try {
    const studentId = req.user.id;

    const [courses] = await db.query(`
      SELECT c.*, u.name as teacher_name,
             e.enrolled_at, e.status as enrollment_status,
             COUNT(a.id) as assignment_count
      FROM courses c
      JOIN enrollments e ON c.id = e.course_id
      JOIN users u ON c.teacher_id = u.id
      LEFT JOIN assignments a ON c.id = a.course_id AND a.status = 'published'
      WHERE e.student_id = ?
      GROUP BY c.id
      ORDER BY c.title ASC
    `, [studentId]);

    res.render('student/courses/list', {
      title: 'My Courses',
      user: {
        ...req.user,
        initials: Helpers.generateInitials(req.user)
      },
      courses
    });

  } catch (error) {
    console.error('Get courses error:', error);
    req.flash('error', 'Error loading courses');
    res.redirect('/student/dashboard');
  }
};

exports.getGrades = async (req, res) => {
  try {
    const studentId = req.user.id;

    const [grades] = await db.query(`
      SELECT g.*, a.title as assignment_title, a.max_points,
             c.title as course_title, c.course_code,
             s.submitted_at, s.is_late
      FROM grades g
      JOIN submissions s ON g.submission_id = s.id
      JOIN assignments a ON g.assignment_id = a.id
      JOIN courses c ON a.course_id = c.id
      WHERE g.student_id = ?
      ORDER BY g.graded_at DESC
    `, [studentId]);

    const [performance] = await db.query(`
      SELECT 
        COUNT(*) as total_assignments,
        AVG(g.points_earned / a.max_points * 100) as average_score,
        SUM(CASE WHEN g.grade IN ('A', 'A-', 'B+', 'B') THEN 1 ELSE 0 END) as good_grades
      FROM grades g
      JOIN assignments a ON g.assignment_id = a.id
      WHERE g.student_id = ?
    `, [studentId]);

    res.render('student/grades/overview', {
      title: 'My Grades',
      user: {
        ...req.user,
        initials: Helpers.generateInitials(req.user)
      },
      grades,
      performance: performance[0] || {}
    });

  } catch (error) {
    console.error('Get grades error:', error);
    req.flash('error', 'Error loading grades');
    res.redirect('/student/dashboard');
  }
};

// Keep your other methods...
exports.submitAssignment = async (req, res) => {
  // Your existing submitAssignment method...
};

exports.markNotificationAsRead = async (req, res) => {
  // Your existing markNotificationAsRead method...
};

exports.showAvailableCourses = async (req, res) => {
  try {
    const studentId = req.user.id;
    const [courses] = await db.query(`
      SELECT c.*, u.name as instructor_name
      FROM courses c
      JOIN users u ON c.teacher_id = u.id
      WHERE c.status = 'active'
      AND c.id NOT IN (SELECT course_id FROM enrollments WHERE student_id = ?)
    `, [studentId]);

    res.render('student/courses/enroll', {
      title: 'Available Courses',
      user: { ...req.user, initials: Helpers.generateInitials(req.user) },
      courses,
      currentPage: 'enroll'
    });
  } catch (error) {
    console.error('Show available courses error:', error);
    req.flash('error', 'Error loading available courses');
    res.redirect('/student/dashboard');
  }
};

exports.viewCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const [course] = await db.query(`
      SELECT c.*, u.name as instructor_name
      FROM courses c
      JOIN users u ON c.teacher_id = u.id
      WHERE c.id = ?
    `, [courseId]);

    if (!course.length) {
      req.flash('error', 'Course not found');
      return res.redirect('/student/courses');
    }

    const [materials] = await db.query('SELECT * FROM course_materials WHERE course_id = ?', [courseId]);
    const [assignments] = await db.query('SELECT * FROM assignments WHERE course_id = ? AND status = "published"', [courseId]);

    res.render('student/courses/view', {
      title: course[0].title,
      user: { ...req.user, initials: Helpers.generateInitials(req.user) },
      course: course[0],
      materials,
      assignments,
      currentPage: 'courses'
    });
  } catch (error) {
    console.error('View course error:', error);
    req.flash('error', 'Error loading course details');
    res.redirect('/student/courses');
  }
};

exports.enrollInCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const studentId = req.user.id;

    // Implementation of enrollment logic (simplified for fix)
    await db.query('INSERT INTO enrollments (student_id, course_id, status) VALUES (?, ?, ?)', [studentId, courseId, 'active']);

    req.flash('success', 'Successfully enrolled in course');
    res.redirect(`/student/courses/${courseId}`);
  } catch (error) {
    console.error('Enroll in course error:', error);
    req.flash('error', 'Error enrolling in course');
    res.redirect('/student/courses/enroll');
  }
};

exports.viewAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const studentId = req.user.id;

    const [assignment] = await db.query(`
      SELECT a.*, c.title as course_title, c.course_code
      FROM assignments a
      JOIN courses c ON a.course_id = c.id
      WHERE a.id = ?
    `, [assignmentId]);

    if (!assignment.length) {
      req.flash('error', 'Assignment not found');
      return res.redirect('/student/assignments');
    }

    const [submission] = await db.query('SELECT * FROM submissions WHERE assignment_id = ? AND student_id = ?', [assignmentId, studentId]);

    res.render('student/assignments/view', {
      title: assignment[0].title,
      user: { ...req.user, initials: Helpers.generateInitials(req.user) },
      assignment: assignment[0],
      submission: submission[0] || null,
      currentPage: 'assignments'
    });
  } catch (error) {
    console.error('View assignment error:', error);
    req.flash('error', 'Error loading assignment details');
    res.redirect('/student/assignments');
  }
};

exports.getPayments = async (req, res) => {
  try {
    const studentId = req.user.id;
    // Basic implementation for financials page
    const [payments] = await db.query('SELECT * FROM payments WHERE student_id = ? ORDER BY payment_date DESC', [studentId]);

    res.render('student/payments/history', {
      title: 'Financials',
      user: { ...req.user, initials: Helpers.generateInitials(req.user) },
      payments,
      currentPage: 'payments'
    });
  } catch (error) {
    console.error('Get payments error:', error);
    req.flash('error', 'Error loading payment history');
    res.redirect('/student/dashboard');
  }
};

exports.showMakePayment = async (req, res) => {
  res.render('student/payments/make-payment', {
    title: 'Make Payment',
    user: { ...req.user, initials: Helpers.generateInitials(req.user) },
    currentPage: 'payments'
  });
};

exports.handlePayment = async (req, res) => {
  // Logic for handling payment submissions
  res.json({ message: 'Payment handling - Under construction' });
};

exports.viewProfile = async (req, res) => {
  res.render('student/profile/view', {
    title: 'My Profile',
    user: { ...req.user, initials: Helpers.generateInitials(req.user) },
    currentPage: 'profile'
  });
};

exports.showEditProfile = async (req, res) => {
  res.render('student/profile/edit', {
    title: 'Edit Profile',
    user: { ...req.user, initials: Helpers.generateInitials(req.user) },
    currentPage: 'profile'
  });
};

exports.updateProfile = async (req, res) => {
  // Logic for updating profile
};

exports.getNotifications = async (req, res) => {
  try {
    const studentId = req.user.id;
    const [notifications] = await db.query('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC', [studentId]);

    res.render('student/notifications/list', {
      title: 'Notifications',
      user: { ...req.user, initials: Helpers.generateInitials(req.user) },
      notifications,
      currentPage: 'notifications'
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    req.flash('error', 'Error loading notifications');
    res.redirect('/student/dashboard');
  }
};