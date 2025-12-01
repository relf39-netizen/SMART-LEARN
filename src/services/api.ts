
// services/api.ts

import { Student, Question, Teacher, Subject, ExamResult, Assignment, SubjectConfig } from '../types'; 
import { MOCK_STUDENTS, MOCK_QUESTIONS } from '../constants';
import { db } from './firebaseConfig'; // Import Firebase DB

// ---------------------------------------------------------------------------
// 🟢 Web App URL
// ---------------------------------------------------------------------------
export const GOOGLE_SCRIPT_URL: string = 'https://script.google.com/macros/s/AKfycbxuK3FqdTahB8trhbMoD3MbkfvKO774Uxq1D32s3vvjmDxT4IMOfaprncIvD89zbTDj/exec'; 

export interface AppData {
  students: Student[];
  questions: Question[];
  results: ExamResult[];
  assignments: Assignment[];
}

const getUrl = (params: string) => {
  const separator = params.includes('?') ? '&' : '?';
  return `${GOOGLE_SCRIPT_URL}${params}${separator}_t=${Date.now()}`;
};

// ✅ Removed strict normalization to allow dynamic subjects
const normalizeSubject = (rawSubject: string): Subject => {
  return String(rawSubject).trim();
};

const convertToCode = (subject: Subject): string => {
    return subject; // Just pass the string directly
};

// ---------------------------------------------------------------------------
// 🟢 SUBJECT MANAGEMENT (FIREBASE) - KEEP AS REQUESTED
// ---------------------------------------------------------------------------

export const getSubjects = async (school: string): Promise<SubjectConfig[]> => {
  try {
    const snapshot = await db.ref(`subjects/${school}`).once('value');
    const val = snapshot.val();
    if (val) {
      return Object.values(val);
    }
    return [];
  } catch (e) {
    console.error("Error fetching subjects", e);
    return [];
  }
};

export const addSubject = async (school: string, subject: SubjectConfig): Promise<boolean> => {
  try {
    await db.ref(`subjects/${school}/${subject.id}`).set(subject);
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
// 🟢 EXISTING API (GOOGLE APPS SCRIPT)
// ---------------------------------------------------------------------------

export const teacherLogin = async (username: string, password: string): Promise<{success: boolean, teacher?: Teacher}> => {
  if (!GOOGLE_SCRIPT_URL) return { success: false };
  try {
    // ✅ Trim inputs to prevent whitespace errors
    const u = username.trim();
    const p = password.trim();
    const response = await fetch(getUrl(`?type=teacher_login&username=${encodeURIComponent(u)}&password=${encodeURIComponent(p)}`));
    const data = await response.json();
    return data;
  } catch (e) {
    console.error("Login error", e);
    return { success: false };
  }
};

export const getAllTeachers = async (): Promise<Teacher[]> => {
  if (!GOOGLE_SCRIPT_URL) return [];
  try {
    const response = await fetch(getUrl(`?type=get_teachers`));
    const data = await response.json();
    return Array.isArray(data) ? data : [];
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
    if (!GOOGLE_SCRIPT_URL) return { success: false, message: 'No URL' };
    try {
        const params = new URLSearchParams();
        params.append('type', 'manage_teacher');
        
        if (data.action) params.append('action', data.action);
        if (data.id) params.append('id', String(data.id));
        if (data.username) params.append('username', data.username);
        if (data.password) params.append('password', data.password);
        if (data.name) params.append('name', data.name);
        if (data.school) params.append('school', data.school);
        if (data.role) params.append('role', data.role);
        if (data.gradeLevel) params.append('gradeLevel', data.gradeLevel);
        
        const response = await fetch(getUrl(`?${params.toString()}`));
        return await response.json();
    } catch (e) {
        return { success: false, message: 'Connection Error' };
    }
};

export const manageStudent = async (data: { action: 'add' | 'edit' | 'delete', id?: string, name?: string, school?: string, avatar?: string, grade?: string, teacherId?: string }): Promise<{success: boolean, student?: Student, message?: string, rawError?: boolean}> => {
  if (!GOOGLE_SCRIPT_URL) return { success: false, message: 'No URL' };
  
  try {
    const params = new URLSearchParams();
    params.append('type', data.action === 'add' ? 'add_student' : 'manage_student');
    
    if (data.action) params.append('action', data.action);
    if (data.id) params.append('id', String(data.id));
    if (data.name) params.append('name', String(data.name));
    if (data.school) params.append('school', String(data.school));
    if (data.avatar) params.append('avatar', String(data.avatar));
    if (data.grade) params.append('grade', String(data.grade));
    if (data.teacherId) params.append('teacherId', String(data.teacherId));
    
    const response = await fetch(getUrl(`?${params.toString()}`));
    const text = await response.text();

    try {
        const result = JSON.parse(text);
        if (data.action === 'add' && result.success && !result.student && result.id) {
             return { 
                 success: true, 
                 student: { id: result.id, name: result.name, school: result.school, avatar: result.avatar, stars: 0, grade: result.grade, teacherId: result.teacherId } 
             };
        }
        return result;
    } catch (jsonError) {
        return { success: false, message: 'Server returned non-JSON response', rawError: true };
    }
  } catch (e) {
    return { success: false, message: 'Connection Error' };
  }
};

export const addStudent = async (name: string, school: string, avatar: string, grade: string = 'P6', teacherId?: string): Promise<Student | null> => {
  const result = await manageStudent({ action: 'add', name, school, avatar, grade, teacherId });
  if (result.success && result.student) return result.student;
  if (result.success && (result as any).id) return result as any;
  return null;
};

export const getTeacherDashboard = async (school: string) => {
  if (!GOOGLE_SCRIPT_URL) return { students: [], results: [], assignments: [], questions: [] };
  
  try {
    const response = await fetch(getUrl(`?type=teacher_data&school=${school}`));
    const data = await response.json();

    const cleanQuestions = (data.questions || []).map((q: any) => ({
      ...q,
      id: String(q.id).trim(),
      text: String(q.text || ''), 
      subject: normalizeSubject(q.subject),
      choices: q.choices.map((c: any) => ({ 
          ...c, 
          id: String(c.id), 
          text: String(c.text || '') 
      })),
      correctChoiceId: String(q.correctChoiceId),
      grade: q.grade || 'ALL',
      school: q.school || 'CENTER',
      teacherId: q.teacherId ? String(q.teacherId) : undefined
    }));
    
    const cleanStudents = (data.students || []).map((s: any) => ({
      ...s,
      id: String(s.id).trim(),
      teacherId: s.teacherId ? String(s.teacherId) : undefined
    }));

    const cleanAssignments = (data.assignments || []).map((a: any) => ({
      id: String(a.id),
      school: String(a.school),
      subject: normalizeSubject(a.subject),
      grade: a.grade || 'ALL', 
      questionCount: Number(a.questionCount),
      deadline: String(a.deadline).split('T')[0],
      createdBy: String(a.createdBy),
      title: a.title || '' // ✅ Read Title
    }));

    // 🟢 Clean and Fix Results (Handle column shifts)
    const cleanResults = (data.results || []).map((r: any) => {
      let subject = normalizeSubject(r.subject);
      let score = Number(r.score);
      let total = Number(r.total);

      // ⚠️ Heuristic Fix: Detect shifted columns
      // If 'total' is NaN (likely a string subject) AND 'subject' looks like a number (likely a score)
      if (isNaN(total) && !isNaN(Number(r.subject))) {
          // Assuming shift: Subject(Col5) is Score, Score(Col6) is Total, Total(Col7) is Subject
          // Check if r.score is also a number (Total)
          if (!isNaN(Number(r.score))) {
             const realScore = Number(r.subject);
             const realTotal = Number(r.score);
             const realSubject = String(r.total); // Normalize this?
             
             return {
                id: Math.random().toString(36).substr(2, 9),
                studentId: String(r.studentId),
                subject: normalizeSubject(realSubject),
                score: realScore,
                totalQuestions: realTotal,
                timestamp: new Date(r.timestamp).getTime(),
                assignmentId: r.assignmentId !== '-' ? r.assignmentId : undefined
             };
          }
      }

      return {
        id: Math.random().toString(36).substr(2, 9),
        studentId: String(r.studentId),
        subject: subject,
        score: isNaN(score) ? 0 : score,
        totalQuestions: isNaN(total) ? 0 : total,
        timestamp: new Date(r.timestamp).getTime(),
        assignmentId: r.assignmentId !== '-' ? r.assignmentId : undefined
      };
    });

    return { ...data, students: cleanStudents, questions: cleanQuestions, assignments: cleanAssignments, results: cleanResults };
  } catch (e) {
    return { students: [], results: [], assignments: [], questions: [] };
  }
}

export const addQuestion = async (question: any): Promise<boolean> => {
  if (!GOOGLE_SCRIPT_URL) return false;
  try {
    const subjectCode = convertToCode(question.subject);
    const params = new URLSearchParams({
      type: 'add_question',
      subject: subjectCode,
      text: question.text,
      image: question.image || '',
      c1: question.c1, c2: question.c2, c3: question.c3, c4: question.c4,
      correct: question.correct,
      explanation: question.explanation,
      grade: question.grade,
      school: question.school || '',
      teacherId: question.teacherId || ''
    });
    await fetch(getUrl(`?${params.toString()}`));
    return true;
  } catch (e) {
    return false;
  }
};

export const editQuestion = async (question: any): Promise<boolean> => {
  if (!GOOGLE_SCRIPT_URL) return false;
  try {
    const subjectCode = convertToCode(question.subject);
    const params = new URLSearchParams({
      type: 'edit_question',
      id: question.id,
      subject: subjectCode,
      text: question.text,
      image: question.image || '',
      c1: question.c1, c2: question.c2, c3: question.c3, c4: question.c4,
      correct: question.correct,
      explanation: question.explanation,
      grade: question.grade
    });
    const response = await fetch(getUrl(`?${params.toString()}`));
    const result = await response.json();
    return result.success;
  } catch (e) {
    return false;
  }
};

export const deleteQuestion = async (id: string): Promise<boolean> => {
  if (!GOOGLE_SCRIPT_URL) return false;
  try {
    const response = await fetch(getUrl(`?type=delete_question&id=${encodeURIComponent(id)}`));
    try {
        const result = await response.json();
        return result.success !== false;
    } catch {
        return response.ok;
    }
  } catch (e) {
    return false;
  }
};

export const addAssignment = async (school: string, subject: string, grade: string, questionCount: number, deadline: string, createdBy: string, title: string = ''): Promise<boolean> => {
  if (!GOOGLE_SCRIPT_URL) return false;
  try {
    const params = new URLSearchParams({
        type: 'add_assignment',
        school,
        subject,
        grade, 
        questionCount: String(questionCount),
        deadline,
        createdBy,
        title: title // ✅ Send Title
    });
    await fetch(getUrl(`?${params.toString()}`));
    return true;
  } catch (e) {
    return false;
  }
};

export const deleteAssignment = async (id: string): Promise<boolean> => {
  if (!GOOGLE_SCRIPT_URL) return false;
  try {
    const response = await fetch(getUrl(`?type=delete_assignment&id=${encodeURIComponent(id)}`));
    const text = await response.text();
    try {
        const result = JSON.parse(text);
        return result.success !== false;
    } catch {
        return response.ok;
    }
  } catch (e) {
    return false;
  }
};

export const saveScore = async (studentId: string, studentName: string, school: string, score: number, total: number, subject: string, assignmentId?: string) => {
  if (!GOOGLE_SCRIPT_URL) return false;
  try {
    const aidParam = assignmentId ? `&assignmentId=${encodeURIComponent(assignmentId)}` : '';
    const url = `?type=save_score&studentId=${studentId}&studentName=${encodeURIComponent(studentName)}&school=${encodeURIComponent(school)}&score=${score}&total=${total}&subject=${encodeURIComponent(subject)}${aidParam}`;
    await fetch(getUrl(url));
    return true;
  } catch (e) {
    return false;
  }
}

export const fetchAppData = async (): Promise<AppData> => {
  if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL === '') {
    return { students: MOCK_STUDENTS, questions: MOCK_QUESTIONS, results: [], assignments: [] };
  }
  try {
    const response = await fetch(getUrl(`?type=json`));
    const textData = await response.text();
    if (textData.trim().startsWith('<')) throw new Error('Invalid JSON response');
    const data = JSON.parse(textData);
    
    const cleanStudents = (data.students || []).map((s: any) => ({
      ...s, id: String(s.id).trim(), stars: Number(s.stars) || 0, grade: s.grade || 'P6',
      teacherId: s.teacherId ? String(s.teacherId) : undefined
    }));
    
    const cleanQuestions = (data.questions || []).map((q: any) => ({
      ...q, 
      id: String(q.id).trim(), 
      text: String(q.text || ''), 
      subject: normalizeSubject(q.subject),
      choices: q.choices.map((c: any) => ({ 
          ...c, 
          id: String(c.id),
          text: String(c.text || '') 
      })),
      correctChoiceId: String(q.correctChoiceId),
      grade: q.grade || 'ALL',
      school: q.school || 'CENTER',
      teacherId: q.teacherId ? String(q.teacherId) : undefined
    }));

    // 🟢 Clean Results with Fix Logic (Same as Teacher Dashboard)
    const cleanResults = (data.results || []).map((r: any) => {
      let subject = normalizeSubject(r.subject);
      let score = Number(r.score);
      let total = Number(r.total);

      // Heuristic Fix for swapped columns in Google Sheet
      if (isNaN(total) && !isNaN(Number(r.subject)) && !isNaN(Number(r.score))) {
          return {
            id: Math.random().toString(36).substr(2, 9),
            studentId: String(r.studentId),
            subject: normalizeSubject(String(r.total)), // Subject is in Total column
            score: Number(r.subject),                   // Score is in Subject column
            totalQuestions: Number(r.score),            // Total is in Score column
            timestamp: new Date(r.timestamp).getTime(),
            assignmentId: r.assignmentId !== '-' ? r.assignmentId : undefined
          };
      }

      return {
        id: Math.random().toString(36).substr(2, 9),
        studentId: String(r.studentId),
        subject: subject,
        score: isNaN(score) ? 0 : score,
        totalQuestions: isNaN(total) ? 0 : total,
        timestamp: new Date(r.timestamp).getTime(),
        assignmentId: r.assignmentId !== '-' ? r.assignmentId : undefined
      };
    });
    
    const cleanAssignments = (data.assignments || []).map((a: any) => ({
      id: String(a.id), 
      school: String(a.school), 
      subject: normalizeSubject(a.subject),
      grade: a.grade || 'ALL', 
      questionCount: Number(a.questionCount), 
      deadline: String(a.deadline).split('T')[0], 
      createdBy: String(a.createdBy),
      title: a.title || '' // ✅ Read Title
    }));

    return { students: cleanStudents, questions: cleanQuestions, results: cleanResults, assignments: cleanAssignments };
  } catch (error) {
    return { students: MOCK_STUDENTS, questions: MOCK_QUESTIONS, results: [], assignments: [] };
  }
};
