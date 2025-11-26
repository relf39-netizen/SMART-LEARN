
// services/api.ts

import { Student, Question, Teacher, Subject, ExamResult, Assignment } from '../types'; 
import { MOCK_STUDENTS, MOCK_QUESTIONS } from '../constants';

// ---------------------------------------------------------------------------
// 🟢 Web App URL (Updated)
// ---------------------------------------------------------------------------
export const GOOGLE_SCRIPT_URL: string = 'https://script.google.com/macros/s/AKfycbxuK3FqdTahB8trhbMoD3MbkfvKO774Uxq1D32s3vvjmDxT4IMOfaprncIvD89zbTDj/exec'; 

export interface AppData {
  students: Student[];
  questions: Question[];
  results: ExamResult[];
  assignments: Assignment[];
}

// 🔄 Helper: Add Timestamp to prevent caching
const getUrl = (params: string) => {
  const separator = params.includes('?') ? '&' : '?';
  return `${GOOGLE_SCRIPT_URL}${params}${separator}_t=${Date.now()}`;
};

// 🔄 Helper: Normalize Subject
const normalizeSubject = (rawSubject: string): Subject => {
  const s = String(rawSubject).trim().toUpperCase();
  if (s === 'MATH' || s === 'คณิตศาสตร์' || s === 'คณิต') return Subject.MATH;
  if (s === 'THAI' || s === 'ภาษาไทย' || s === 'ไทย') return Subject.THAI;
  if (s === 'SCIENCE' || s === 'วิทยาศาสตร์' || s === 'วิทย์') return Subject.SCIENCE;
  if (s === 'ENGLISH' || s === 'ภาษาอังกฤษ' || s === 'อังกฤษ') return Subject.ENGLISH;
  return Subject.MATH; 
};

// 🔄 Helper: Convert Subject to Code
const convertToCode = (subjectEnum: Subject): string => {
    if (subjectEnum === Subject.MATH) return 'MATH';
    if (subjectEnum === Subject.THAI) return 'THAI';
    if (subjectEnum === Subject.SCIENCE) return 'SCIENCE';
    if (subjectEnum === Subject.ENGLISH) return 'ENGLISH';
    return 'MATH';
};

// ✅ Teacher Login
export const teacherLogin = async (username: string, password: string): Promise<{success: boolean, teacher?: Teacher}> => {
  if (!GOOGLE_SCRIPT_URL) return { success: false };
  try {
    const response = await fetch(getUrl(`?type=teacher_login&username=${username}&password=${password}`));
    const data = await response.json();
    return data;
  } catch (e) {
    console.error("Login error", e);
    return { success: false };
  }
};

// ✅ Get All Teachers (Admin)
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

// ✅ Manage Teacher (Admin: Add/Edit/Delete)
export const manageTeacher = async (data: any) => {
    if (!GOOGLE_SCRIPT_URL) return { success: false, message: 'No URL' };
    try {
        const params = new URLSearchParams({ type: 'manage_teacher', ...data });
        const response = await fetch(getUrl(`?${params.toString()}`));
        return await response.json();
    } catch (e) {
        return { success: false, message: 'Connection Error' };
    }
};

// ✅ Manage Student (Add/Edit/Delete)
export const manageStudent = async (data: { action: 'add' | 'edit' | 'delete', id?: string, name?: string, school?: string, avatar?: string, grade?: string }): Promise<{success: boolean, student?: Student, message?: string, rawError?: boolean}> => {
  if (!GOOGLE_SCRIPT_URL) return { success: false, message: 'No URL' };
  
  try {
    const params = new URLSearchParams();
    
    // Add Legacy Support for 'add' action to match old Script if needed
    if (data.action === 'add') {
        params.append('type', 'add_student');
    } else {
        params.append('type', 'manage_student');
    }
    
    Object.keys(data).forEach(key => {
        if (data[key as keyof typeof data] !== undefined && data[key as keyof typeof data] !== null) {
            params.append(key, String(data[key as keyof typeof data]));
        }
    });
    
    console.log("Calling API manageStudent:", params.toString());
    const response = await fetch(getUrl(`?${params.toString()}`));
    const text = await response.text();

    try {
        const result = JSON.parse(text);
        
        // Legacy format fix: 'add' usually returns { success:true, id:..., name:... } but UI needs { student: ... }
        if (data.action === 'add' && result.success && !result.student && result.id) {
             return { 
                 success: true, 
                 student: { id: result.id, name: result.name, school: result.school, avatar: result.avatar, stars: 0, grade: result.grade } 
             };
        }
        
        return result;

    } catch (jsonError) {
        console.warn("API returned non-JSON:", text);
        return { 
            success: false, 
            message: 'Server returned non-JSON response',
            rawError: true 
        };
    }

  } catch (e) {
    console.error("Manage student connection error", e);
    return { success: false, message: 'Connection Error: ไม่สามารถเชื่อมต่อกับ Google Script ได้' };
  }
};

// ✅ Add New Student (Legacy Wrapper)
export const addStudent = async (name: string, school: string, avatar: string, grade: string = 'P6'): Promise<Student | null> => {
  const result = await manageStudent({ action: 'add', name, school, avatar, grade });
  if (result.success && result.student) {
      return result.student;
  }
  // Fallback for legacy script return
  if (result.success && (result as any).id) {
      return result as any;
  }
  return null;
};

// ✅ Get Teacher Dashboard Data
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
      school: q.school || 'CENTER'
    }));

    return { ...data, questions: cleanQuestions };
  } catch (e) {
    console.error("Dashboard error", e);
    return { students: [], results: [], assignments: [], questions: [] };
  }
}

// ✅ Add Question
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
      school: question.school || ''
    });
    await fetch(getUrl(`?${params.toString()}`));
    return true;
  } catch (e) {
    return false;
  }
};

// ✅ Add Assignment
export const addAssignment = async (school: string, subject: string, questionCount: number, deadline: string, createdBy: string): Promise<boolean> => {
  if (!GOOGLE_SCRIPT_URL) return false;
  try {
    const url = `?type=add_assignment&school=${encodeURIComponent(school)}&subject=${encodeURIComponent(subject)}&questionCount=${questionCount}&deadline=${deadline}&createdBy=${encodeURIComponent(createdBy)}`;
    await fetch(getUrl(url));
    return true;
  } catch (e) {
    return false;
  }
};

// ✅ Save Score
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

// ✅ Fetch Initial App Data
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
      ...s, id: String(s.id).trim(), stars: Number(s.stars) || 0, grade: s.grade || 'P6'
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
      school: q.school
    }));

    const cleanResults = (data.results || []).map((r: any) => ({
      id: Math.random().toString(36).substr(2, 9),
      studentId: String(r.studentId),
      subject: normalizeSubject(r.subject),
      score: Number(r.score),
      totalQuestions: Number(r.total),
      timestamp: new Date(r.timestamp).getTime(),
      assignmentId: r.assignmentId !== '-' ? r.assignmentId : undefined
    }));
    const cleanAssignments = (data.assignments || []).map((a: any) => ({
      id: String(a.id), school: String(a.school), subject: normalizeSubject(a.subject),
      questionCount: Number(a.questionCount), deadline: String(a.deadline).split('T')[0], createdBy: String(a.createdBy)
    }));

    return { students: cleanStudents, questions: cleanQuestions, results: cleanResults, assignments: cleanAssignments };
  } catch (error) {
    return { students: MOCK_STUDENTS, questions: MOCK_QUESTIONS, results: [], assignments: [] };
  }
};
