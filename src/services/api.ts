
// services/api.ts

import { Student, Question, Teacher, Subject, ExamResult, Assignment, SubjectConfig } from '../types'; 
import { MOCK_STUDENTS, MOCK_QUESTIONS } from '../constants';
import { db, firebase } from './firebaseConfig'; // Import Firebase DB

export interface AppData {
  students: Student[];
  questions: Question[];
  results: ExamResult[];
  assignments: Assignment[];
}

// Helper: Convert Firebase Object to Array
const snapshotToArray = <T>(snapshot: any): T[] => {
  if (!snapshot || !snapshot.val()) return [];
  const returnArr: T[] = [];
  snapshot.forEach((childSnapshot: any) => {
    const item = childSnapshot.val();
    item.id = childSnapshot.key; // Use Firebase Key as ID
    returnArr.push(item);
  });
  return returnArr;
};

// 🔄 ฟังก์ชันช่วยแปลงรหัสวิชา (ถ้าจำเป็น)
const normalizeSubject = (rawSubject: string): Subject => {
  return String(rawSubject).trim();
};

// ---------------------------------------------------------------------------
// 🟢 SYSTEM INITIALIZATION (SEEDING)
// ---------------------------------------------------------------------------

const seedDatabase = async () => {
    console.log("🌱 Seeding database with initial data...");
    
    // 1. Seed Students
    const studentRef = db.ref('students');
    for (const s of MOCK_STUDENTS) {
        await studentRef.child(s.id).set({ ...s, stars: 0 });
    }

    // 2. Seed Questions
    const questionRef = db.ref('questions');
    for (const q of MOCK_QUESTIONS) {
        const newRef = questionRef.push();
        await newRef.set({ 
            ...q, 
            id: newRef.key,
            school: 'CENTER', // Default to center so everyone sees it
            grade: q.grade || 'P6'
        });
    }

    // 3. Seed Default Subjects (Optional)
    const defaultSubjects = [
        { name: 'คณิตศาสตร์', icon: 'Calculator', color: 'bg-red-50 hover:bg-red-100 border-red-200 text-red-600', grade: 'ALL' },
        { name: 'วิทยาศาสตร์', icon: 'FlaskConical', color: 'bg-green-50 hover:bg-green-100 border-green-200 text-green-600', grade: 'ALL' },
        { name: 'ภาษาไทย', icon: 'Book', color: 'bg-yellow-50 hover:bg-yellow-100 border-yellow-200 text-yellow-600', grade: 'ALL' },
        { name: 'ภาษาอังกฤษ', icon: 'Languages', color: 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-600', grade: 'ALL' }
    ];
    // Seed subjects for "System" or default school
    // Note: In a real scenario, we might want to attach this to a specific school
};

// ---------------------------------------------------------------------------
// 🟢 SUBJECT MANAGEMENT (FIREBASE)
// ---------------------------------------------------------------------------

export const getSubjects = async (school: string): Promise<SubjectConfig[]> => {
  try {
    const snapshot = await db.ref(`subjects/${school}`).once('value');
    if (snapshot.exists()) {
        const data = snapshot.val();
        return Object.keys(data).map(key => ({ ...data[key], id: key }));
    }
    // Fallback: If no subjects, return default list visually (but don't save unless added)
    return [];
  } catch (e) {
    console.error("Error fetching subjects", e);
    return [];
  }
};

export const addSubject = async (school: string, subject: SubjectConfig): Promise<boolean> => {
  try {
    const newRef = db.ref(`subjects/${school}`).push();
    await newRef.set({ ...subject, id: newRef.key });
    return true;
  } catch (e) {
    console.error("Error adding subject", e);
    return false;
  }
};

export const deleteSubject = async (school: string, subjectId: string): Promise<boolean> => {
  try {
    await db.ref(`subjects/${school}/${subjectId}`).remove();
    return true;
  } catch (e) {
    console.error("Error deleting subject", e);
    return false;
  }
};

// ---------------------------------------------------------------------------
// 🟢 TEACHER MANAGEMENT (FIREBASE)
// ---------------------------------------------------------------------------

export const teacherLogin = async (username: string, password: string): Promise<{success: boolean, teacher?: Teacher}> => {
  try {
    // 1. Try to find the user in Firebase
    const snapshot = await db.ref('teachers')
                             .orderByChild('username')
                             .equalTo(username)
                             .once('value');
    
    if (snapshot.exists()) {
      const teachers = snapshotToArray<Teacher>(snapshot);
      const teacher = teachers[0];
      if (teacher && teacher.password === password) {
        return { success: true, teacher };
      }
    } else {
        // 2. 🚨 SPECIAL FALLBACK: If 'admin' doesn't exist, CREATE IT automatically
        // This solves the "No Data" problem for the first login.
        if (username === 'admin' && password === '1234') {
             const newAdmin: Teacher = {
                 id: 'admin_root',
                 username: 'admin',
                 password: '1234',
                 name: 'Super Admin',
                 school: 'System', // System level
                 role: 'ADMIN',
                 gradeLevel: 'ALL'
             };
             await db.ref('teachers/admin_root').set(newAdmin);
             return { success: true, teacher: newAdmin };
        }
    }
    return { success: false };
  } catch (e) {
    console.error("Login error", e);
    return { success: false };
  }
};

export const getAllTeachers = async (): Promise<Teacher[]> => {
  try {
    const snapshot = await db.ref('teachers').once('value');
    return snapshotToArray<Teacher>(snapshot);
  } catch (e) {
    console.error("Get teachers error", e);
    return [];
  }
};

export const manageTeacher = async (data: { 
    action: 'add' | 'delete' | 'edit', 
    id?: string, 
    username?: string, 
    password?: string, 
    name?: string, 
    school?: string, 
    role?: string, 
    gradeLevel?: string 
}): Promise<{success: boolean, message?: string}> => {
    try {
        if (data.action === 'add') {
             const newRef = db.ref('teachers').push();
             await newRef.set({
                 id: newRef.key,
                 name: data.name,
                 username: data.username,
                 password: data.password,
                 school: data.school,
                 role: data.role,
                 gradeLevel: data.gradeLevel
             });
        } else if (data.action === 'edit' && data.id) {
             const updateData: any = {};
             if (data.name) updateData.name = data.name;
             if (data.password) updateData.password = data.password;
             if (data.school) updateData.school = data.school;
             if (data.gradeLevel) updateData.gradeLevel = data.gradeLevel;
             await db.ref(`teachers/${data.id}`).update(updateData);
        } else if (data.action === 'delete' && data.id) {
             await db.ref(`teachers/${data.id}`).remove();
        }
        return { success: true };
    } catch (e) {
        return { success: false, message: 'Firebase Error' };
    }
};

// ---------------------------------------------------------------------------
// 🟢 STUDENT MANAGEMENT (FIREBASE)
// ---------------------------------------------------------------------------

export const manageStudent = async (data: { action: 'add' | 'edit' | 'delete', id?: string, name?: string, school?: string, avatar?: string, grade?: string, teacherId?: string }): Promise<{success: boolean, student?: Student, message?: string}> => {
  try {
    if (data.action === 'add') {
         // สร้าง ID 5 หลักแบบสุ่ม (เช็คซ้ำง่ายๆ)
         let newId = Math.floor(10000 + Math.random() * 90000).toString();
         
         await db.ref(`students/${newId}`).set({
             id: newId,
             name: data.name,
             school: data.school,
             avatar: data.avatar,
             grade: data.grade,
             teacherId: data.teacherId,
             stars: 0
         });
         
         const newStudent: Student = { 
             id: newId, 
             name: data.name!, 
             school: data.school, 
             avatar: data.avatar!, 
             stars: 0, 
             grade: data.grade, 
             teacherId: data.teacherId 
         };
         return { success: true, student: newStudent };

    } else if (data.action === 'edit' && data.id) {
         const updateData: any = {};
         if (data.name) updateData.name = data.name;
         if (data.avatar) updateData.avatar = data.avatar;
         if (data.grade) updateData.grade = data.grade;
         
         await db.ref(`students/${data.id}`).update(updateData);
         return { success: true };

    } else if (data.action === 'delete' && data.id) {
         await db.ref(`students/${data.id}`).remove();
         return { success: true };
    }
    return { success: false };
  } catch (e) {
    return { success: false, message: 'Firebase Error' };
  }
};

export const addStudent = async (name: string, school: string, avatar: string, grade: string = 'P6', teacherId?: string): Promise<Student | null> => {
  const result = await manageStudent({ action: 'add', name, school, avatar, grade, teacherId });
  if (result.success && result.student) return result.student;
  return null;
};

// ---------------------------------------------------------------------------
// 🟢 DASHBOARD DATA (FIREBASE)
// ---------------------------------------------------------------------------

export const getTeacherDashboard = async (school: string) => {
  try {
    const [studentsSnap, resultsSnap, assignmentsSnap, questionsSnap] = await Promise.all([
        db.ref('students').orderByChild('school').equalTo(school).once('value'),
        db.ref('results').orderByChild('school').equalTo(school).once('value'),
        db.ref('assignments').orderByChild('school').equalTo(school).once('value'),
        db.ref('questions').once('value') 
    ]);

    const students = snapshotToArray<Student>(studentsSnap);
    const results = snapshotToArray<ExamResult>(resultsSnap);
    const assignments = snapshotToArray<Assignment>(assignmentsSnap);
    const questions = snapshotToArray<Question>(questionsSnap);

    const filteredQuestions = questions.filter(q => q.school === school || q.school === 'CENTER' || q.school === 'Admin');

    return { 
        students: students, 
        results: results, 
        assignments: assignments, 
        questions: filteredQuestions 
    };
  } catch (e) {
    console.error(e);
    return { students: [], results: [], assignments: [], questions: [] };
  }
}

// ---------------------------------------------------------------------------
// 🟢 QUESTION MANAGEMENT (FIREBASE)
// ---------------------------------------------------------------------------

export const addQuestion = async (question: any): Promise<boolean> => {
  try {
    const newRef = db.ref('questions').push();
    await newRef.set({
      ...question,
      id: newRef.key,
      choices: [
          { id: '1', text: question.c1 },
          { id: '2', text: question.c2 },
          { id: '3', text: question.c3 },
          { id: '4', text: question.c4 },
      ],
      correctChoiceId: question.correct
    });
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
};

export const editQuestion = async (question: any): Promise<boolean> => {
  try {
    if (!question.id) return false;
    await db.ref(`questions/${question.id}`).update({
        subject: question.subject,
        grade: question.grade,
        text: question.text,
        image: question.image || '',
        choices: [
            { id: '1', text: question.c1 },
            { id: '2', text: question.c2 },
            { id: '3', text: question.c3 },
            { id: '4', text: question.c4 },
        ],
        correctChoiceId: question.correct,
        explanation: question.explanation
    });
    return true;
  } catch (e) {
    return false;
  }
};

export const deleteQuestion = async (id: string): Promise<boolean> => {
  try {
    await db.ref(`questions/${id}`).remove();
    return true;
  } catch (e) {
    return false;
  }
};

// ---------------------------------------------------------------------------
// 🟢 ASSIGNMENT MANAGEMENT (FIREBASE)
// ---------------------------------------------------------------------------

export const addAssignment = async (school: string, subject: string, grade: string, questionCount: number, deadline: string, createdBy: string, title: string = ''): Promise<boolean> => {
  try {
    const newRef = db.ref('assignments').push();
    await newRef.set({
        id: newRef.key,
        school,
        subject,
        grade,
        questionCount,
        deadline,
        createdBy,
        title
    });
    return true;
  } catch (e) {
    return false;
  }
};

export const deleteAssignment = async (id: string): Promise<boolean> => {
  try {
    await db.ref(`assignments/${id}`).remove();
    return true;
  } catch (e) {
    return false;
  }
};

// ---------------------------------------------------------------------------
// 🟢 SCORE SAVING (FIREBASE)
// ---------------------------------------------------------------------------

export const saveScore = async (studentId: string, studentName: string, school: string, score: number, total: number, subject: string, assignmentId?: string) => {
  try {
    const newRef = db.ref('results').push();
    await newRef.set({
        id: newRef.key,
        studentId,
        studentName,
        school,
        score,
        totalQuestions: total,
        subject,
        assignmentId: assignmentId || '-',
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
    
    // Update Student Stars
    const studentRef = db.ref(`students/${studentId}`);
    studentRef.child('stars').transaction((currentStars) => {
        return (currentStars || 0) + score;
    });

    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// 🟢 FETCH ALL APP DATA (INITIAL LOAD)
// ---------------------------------------------------------------------------

export const fetchAppData = async (): Promise<AppData> => {
  try {
    const snapshot = await db.ref('/').once('value');
    let data = snapshot.val();

    // 🌟 AUTO-SEED: If database is empty, seed mock data
    if (!data || (!data.students && !data.questions)) {
        await seedDatabase();
        // Fetch again after seeding
        const newSnap = await db.ref('/').once('value');
        data = newSnap.val();
    }

    if (!data) return { students: [], questions: [], results: [], assignments: [] };

    const studentsArr: Student[] = data.students 
        ? Object.keys(data.students).map(k => ({...data.students[k], id: k})) 
        : [];
        
    const questionsArr: Question[] = data.questions 
        ? Object.keys(data.questions).map(k => ({...data.questions[k], id: k})) 
        : [];

    const resultsArr: ExamResult[] = data.results 
        ? Object.keys(data.results).map(k => ({...data.results[k], id: k})) 
        : [];

    const assignmentsArr: Assignment[] = data.assignments 
        ? Object.keys(data.assignments).map(k => ({...data.assignments[k], id: k})) 
        : [];

    return { 
        students: studentsArr, 
        questions: questionsArr, 
        results: resultsArr, 
        assignments: assignmentsArr 
    };

  } catch (error) {
    console.error("Firebase fetch error:", error);
    return { students: MOCK_STUDENTS, questions: MOCK_QUESTIONS, results: [], assignments: [] };
  }
};
