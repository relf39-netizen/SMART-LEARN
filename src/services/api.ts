// services/api.ts

import { Student, Question, Teacher, Subject, ExamResult, Assignment } from '../types'; 
import { MOCK_STUDENTS, MOCK_QUESTIONS } from '../constants';

// ---------------------------------------------------------------------------
// 🟢 Web App URL
// ---------------------------------------------------------------------------
const GOOGLE_SCRIPT_URL: string = 'https://script.google.com/macros/s/AKfycbx3EwKuxf1L7_iYqoCLCpfHQlu8FyPL9ty8n4oJlSuInj9sMcsSFjQyw39--V2-gQ8U/exec'; 

export interface AppData {
  students: Student[];
  questions: Question[];
  results: ExamResult[];
  assignments: Assignment[];
}

// 🔄 ฟังก์ชันตัวแปลภาษา (Translator): แปลงทุกอย่างให้เป็น Enum ภาษาไทยสำหรับแสดงผล
const normalizeSubject = (rawSubject: string): Subject => {
  // แปลงเป็นตัวพิมพ์ใหญ่และตัดช่องว่าง
  const s = String(rawSubject).trim().toUpperCase();
  
  // เช็คภาษาอังกฤษ
  if (s === 'MATH' || s === 'MATHEMATICS') return Subject.MATH;
  if (s === 'THAI') return Subject.THAI;
  if (s === 'SCIENCE' || s === 'SCI') return Subject.SCIENCE;
  if (s === 'ENGLISH' || s === 'ENG') return Subject.ENGLISH;
  
  // เช็คภาษาไทย (เผื่อมีปนมา)
  if (s.includes('คณิต')) return Subject.MATH;
  if (s.includes('ไทย')) return Subject.THAI;
  if (s.includes('วิทย์') || s.includes('วิทยา')) return Subject.SCIENCE;
  if (s.includes('อังกฤษ')) return Subject.ENGLISH;
  
  return Subject.MATH; // ค่า Default กัน Error
};

// 🔄 ฟังก์ชันแปลงกลับ (Reverse Translator): แปลงไทยกลับเป็นอังกฤษสำหรับบันทึก
const convertToCode = (subjectEnum: Subject): string => {
    if (subjectEnum === Subject.MATH) return 'MATH';
    if (subjectEnum === Subject.THAI) return 'THAI';
    if (subjectEnum === Subject.SCIENCE) return 'SCIENCE';
    if (subjectEnum === Subject.ENGLISH) return 'ENGLISH';
    return 'MATH';
};

export const teacherLogin = async (username: string, password: string): Promise<{success: boolean, teacher?: Teacher}> => {
  if (!GOOGLE_SCRIPT_URL) return { success: false };
  
  try {
    const response = await fetch(`${GOOGLE_SCRIPT_URL}?type=teacher_login&username=${username}&password=${password}`);
    const data = await response.json();
    return data;
  } catch (e) {
    console.error("Login error", e);
    return { success: false };
  }
};

export const getTeacherDashboard = async (school: string) => {
  if (!GOOGLE_SCRIPT_URL) return { students: [], results: [], assignments: [], questions: [] };
  
  try {
    const response = await fetch(`${GOOGLE_SCRIPT_URL}?type=teacher_data&school=${school}`);
    const data = await response.json();

    // แปลงข้อมูลข้อสอบ โดยใช้ตัวแปลภาษา
    const cleanQuestions = (data.questions || []).map((q: any) => ({
      ...q,
      id: String(q.id).trim(),
      subject: normalizeSubject(q.subject), // แปลง SCIENCE -> วิทยาศาสตร์
      choices: q.choices.map((c: any) => ({ ...c, id: String(c.id) })),
      correctChoiceId: String(q.correctChoiceId),
      grade: q.grade || 'ALL',
      school: q.school || 'CENTER'
    }));

    return {
        ...data,
        questions: cleanQuestions
    };
  } catch (e) {
    console.error("Dashboard error", e);
    return { students: [], results: [], assignments: [], questions: [] };
  }
}

export const addStudent = async (name: string, school: string, avatar: string, grade: string): Promise<Student | null> => {
  if (!GOOGLE_SCRIPT_URL) return null;
  try {
    const url = `${GOOGLE_SCRIPT_URL}?type=add_student&name=${encodeURIComponent(name)}&school=${encodeURIComponent(school)}&avatar=${encodeURIComponent(avatar)}&grade=${encodeURIComponent(grade)}`;
    const response = await fetch(url);
    return await response.json();
  } catch (e) {
    return null;
  }
};

export const addQuestion = async (question: any): Promise<boolean> => {
  if (!GOOGLE_SCRIPT_URL) return false;
  try {
    // ✅ แปลงวิชาเป็นภาษาอังกฤษ (MATH) ก่อนส่งไปบันทึก
    const subjectCode = convertToCode(question.subject);
    
    const params = new URLSearchParams({
      type: 'add_question',
      subject: subjectCode, // ส่ง MATH แทน คณิตศาสตร์
      text: question.text,
      image: question.image || '',
      c1: question.c1, c2: question.c2, c3: question.c3, c4: question.c4,
      correct: question.correct,
      explanation: question.explanation,
      grade: question.grade,
      school: question.school || ''
    });
    await fetch(`${GOOGLE_SCRIPT_URL}?${params.toString()}`);
    return true;
  } catch (e) {
    return false;
  }
};

export const addAssignment = async (school: string, subject: string, questionCount: number, deadline: string, createdBy: string): Promise<boolean> => {
  if (!GOOGLE_SCRIPT_URL) return false;
  try {
    // แปลงเป็นอังกฤษก่อนบันทึกเช่นกัน (ถ้าต้องการ) หรือเก็บไทยก็ได้สำหรับ Assignment
    // แต่เพื่อความชัวร์ เก็บอังกฤษดีกว่า
    // (แต่ Assignment เดิมอาจเก็บไทย ถ้าแก้ตรงนี้ การบ้านเก่าอาจกรองเพี้ยน)
    // ดังนั้นสำหรับ Assignment ขออนุญาตส่งค่าตามที่เลือกไปก่อน (ภาษาไทย) 
    // หรือถ้าท่านอยากเปลี่ยนเป็นอังกฤษทั้งหมด แจ้งได้ครับ
    
    const url = `${GOOGLE_SCRIPT_URL}?type=add_assignment&school=${encodeURIComponent(school)}&subject=${encodeURIComponent(subject)}&questionCount=${questionCount}&deadline=${deadline}&createdBy=${encodeURIComponent(createdBy)}`;
    await fetch(url);
    return true;
  } catch (e) {
    return false;
  }
};

export const saveScore = async (studentId: string, studentName: string, school: string, score: number, total: number, subject: string, assignmentId?: string) => {
  if (!GOOGLE_SCRIPT_URL) return false;
  try {
    const aidParam = assignmentId ? `&assignmentId=${encodeURIComponent(assignmentId)}` : '';
    const url = `${GOOGLE_SCRIPT_URL}?type=save_score&studentId=${studentId}&studentName=${encodeURIComponent(studentName)}&school=${encodeURIComponent(school)}&score=${score}&total=${total}&subject=${encodeURIComponent(subject)}${aidParam}`;
    await fetch(url);
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
    const targetUrl = `${GOOGLE_SCRIPT_URL}?type=json`;
    const response = await fetch(targetUrl);
    const textData = await response.text();
    if (textData.trim().startsWith('<')) throw new Error('Invalid JSON response');
    const data = JSON.parse(textData);
    
    const cleanStudents = (data.students || []).map((s: any) => ({
      ...s, id: String(s.id).trim(), stars: Number(s.stars) || 0, grade: s.grade || 'P6'
    }));
    
    const cleanQuestions = (data.questions || []).map((q: any) => ({
      ...q, 
      id: String(q.id).trim(), 
      subject: normalizeSubject(q.subject), // ✅ แปลงทุกอย่างให้เป็นมาตรฐานเดียวกัน
      choices: q.choices.map((c: any) => ({ ...c, id: String(c.id) })),
      correctChoiceId: String(q.correctChoiceId),
      grade: q.grade || 'ALL',
      school: q.school
    }));

    const cleanResults = (data.results || []).map((r: any) => ({
      id: Math.random().toString(36).substr(2, 9),
      studentId: String(r.studentId),
      subject: normalizeSubject(r.subject), // ✅ แปลงผลสอบด้วย
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
