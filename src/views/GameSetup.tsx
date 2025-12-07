
import React, { useState, useEffect } from 'react';
import { Question, Teacher, SubjectConfig } from '../types';
import { ArrowLeft, Play, Layers, Shuffle, GraduationCap } from 'lucide-react';
import { db } from '../services/firebaseConfig';
import { getSubjects, getQuestionsBySubject } from '../services/api';

interface GameSetupProps {
  teacher: Teacher; 
  onBack: () => void;
  onGameCreated: (roomCode: string) => void;
}

const GameSetup: React.FC<GameSetupProps> = ({ teacher, onBack, onGameCreated }) => {
  const [availableSubjects, setAvailableSubjects] = useState<SubjectConfig[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Settings
  const [selectedSubject, setSelectedSubject] = useState<string>('MIXED'); 
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [timePerQuestion, setTimePerQuestion] = useState<number>(20);
  const [selectedGrade, setSelectedGrade] = useState<string>('P6');

  const GRADE_LABELS: Record<string, string> = {
      'P1': 'ป.1', 'P2': 'ป.2', 'P3': 'ป.3',
      'P4': 'ป.4', 'P5': 'ป.5', 'P6': 'ป.6',
      'M1': 'ม.1', 'M2': 'ม.2', 'M3': 'ม.3'
  };

  const GRADE_KEYS = ['P1','P2','P3','P4','P5','P6','M1','M2','M3'];

  useEffect(() => {
    const loadData = async () => {
      // 🟢 Optimized: Load subjects ONLY. Do NOT load all questions.
      const subs = await getSubjects(teacher.school);
      setAvailableSubjects(subs);
      setLoading(false);
    };
    loadData();
  }, [teacher.school]);

  const generateRoomCode = () => {
      return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const handleCreateGame = async () => {
    setLoading(true);

    let finalQuestions: Question[] = [];

    // 🟢 Optimized: Fetch questions on demand based on selection
    if (selectedSubject === 'MIXED') {
        // Warning: MIXED still requires fetching a lot if we want true random.
        // Strategy: Fetch a few from each available subject.
        for (const sub of availableSubjects) {
            const qs = await getQuestionsBySubject(sub.name);
            finalQuestions.push(...qs);
        }
    } else {
        finalQuestions = await getQuestionsBySubject(selectedSubject);
    }

    // Filter by grade and school after fetching specific subjects
    let filtered = finalQuestions.filter(q => 
        (q.grade === selectedGrade || q.grade === 'ALL') &&
        (q.school === teacher.school || q.school === 'CENTER' || q.school === 'Admin')
    );

    filtered.sort(() => 0.5 - Math.random());
    const selectedQuestions = filtered.slice(0, questionCount);

    if (selectedQuestions.length === 0) {
        alert(`ไม่พบข้อสอบสำหรับชั้น ${GRADE_LABELS[selectedGrade]} ในหมวดนี้`);
        setLoading(false);
        return;
    }

    // ✅ Strict Sanitization to prevent Firebase "undefined" error
    const sanitizedQuestions = selectedQuestions.map((q, idx) => ({
        id: String(q.id || `q${idx}`),
        subject: q.subject ? String(q.subject) : 'GENERAL',
        text: q.text ? String(q.text) : '',
        image: q.image ? String(q.image) : '',
        choices: (Array.isArray(q.choices) ? q.choices : []).map((c, cIdx) => ({
            id: c.id ? String(c.id).trim() : `c${cIdx}`,
            text: c.text ? String(c.text) : '',
            image: c.image ? String(c.image) : '' 
        })),
        correctChoiceId: q.correctChoiceId ? String(q.correctChoiceId).trim() : '',
        explanation: q.explanation ? String(q.explanation) : '',
        grade: q.grade ? String(q.grade) : 'ALL',
        school: q.school ? String(q.school) : 'CENTER'
    }));

    try {
        const roomCode = generateRoomCode();
        const roomPath = `games/${roomCode}`;
        
        await db.ref(`${roomPath}/scores`).set({});
        await db.ref(`${roomPath}/questions`).set(sanitizedQuestions);
        await db.ref(`${roomPath}/gameState`).set({
            status: 'LOBBY',
            currentQuestionIndex: 0,
            totalQuestions: sanitizedQuestions.length,
            subject: selectedSubject === 'MIXED' ? 'รวมวิชา' : selectedSubject,
            grade: selectedGrade,
            timePerQuestion: timePerQuestion,
            timer: timePerQuestion,
            schoolId: teacher.school, 
            teacherName: teacher.name
        });
        
        onGameCreated(roomCode); 
    } catch (e) {
        console.error("Firebase Error:", e);
        alert("เกิดข้อผิดพลาดในการสร้างห้อง: " + e);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto min-h-[80vh] flex flex-col pb-10">
       <button onClick={onBack} className="text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4 w-fit">
        <ArrowLeft size={20} /> กลับห้องพักครู
      </button>

      <div className="bg-white rounded-3xl shadow-lg p-6 md:p-8 flex-1 border-t-4 border-purple-500">
        <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center justify-center gap-2">
                <Layers className="text-purple-600" /> ตั้งค่าเกมการแข่งขัน
            </h2>
            <div className="text-sm text-gray-500 mt-2 bg-purple-50 inline-block px-3 py-1 rounded-full border border-purple-100">
                โรงเรียน: {teacher.school}
            </div>
        </div>

        <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2"><GraduationCap size={18}/> 0. เลือกระดับชั้น</label>
            <div className="grid grid-cols-3 gap-2">
                {GRADE_KEYS.map(g => (
                    <button key={g} onClick={() => setSelectedGrade(g)} className={`py-2 rounded-lg border-2 font-bold transition ${selectedGrade === g ? 'border-purple-500 bg-purple-100 text-purple-800 shadow-sm' : 'border-gray-100 hover:bg-gray-50'}`}>
                        {GRADE_LABELS[g]}
                    </button>
                ))}
            </div>
        </div>

        <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-2">1. เลือกวิชา</label>
            <div className="grid grid-cols-2 gap-2">
                <button 
                    onClick={() => setSelectedSubject('MIXED')}
                    className={`p-3 rounded-xl border-2 transition flex flex-col items-center ${selectedSubject === 'MIXED' ? 'border-purple-500 bg-purple-100 text-purple-800' : 'border-gray-200'}`}
                >
                    <Shuffle size={20} className="mb-1"/>
                    <span className="font-bold text-sm">คละทุกวิชา</span>
                </button>
                {availableSubjects.length > 0 ? availableSubjects.map((sub) => (
                     <button 
                        key={sub.id}
                        onClick={() => setSelectedSubject(sub.name)}
                        className={`p-3 rounded-xl border-2 transition ${selectedSubject === sub.name ? 'border-purple-500 bg-purple-100 text-purple-800' : 'border-gray-200'}`}
                    >
                        <span className="font-bold text-sm">{sub.name}</span>
                    </button>
                )) : (
                    <div className="col-span-2 text-center text-sm text-gray-400 p-2 border border-dashed rounded-xl">
                        ยังไม่มีรายวิชา (เพิ่มได้ที่เมนูจัดการรายวิชา)
                    </div>
                )}
            </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
            <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">จำนวนข้อ</label>
                <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-xl border">
                    <input 
                        type="range" min="5" max="50" step="5"
                        value={questionCount} 
                        onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                    />
                    <span className="font-bold text-purple-600 min-w-[30px] text-center">{questionCount}</span>
                </div>
            </div>
            <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">เวลาต่อข้อ (วินาที)</label>
                <select 
                    value={timePerQuestion}
                    onChange={(e) => setTimePerQuestion(parseInt(e.target.value))}
                    className="w-full p-3 rounded-xl border border-gray-200 bg-white font-bold text-gray-700"
                >
                    <option value="10">10 วินาที (เร็ว)</option>
                    <option value="15">15 วินาที</option>
                    <option value="20">20 วินาที (ปกติ)</option>
                    <option value="30">30 วินาที (ช้า)</option>
                </select>
            </div>
        </div>

        <button 
            onClick={handleCreateGame}
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 rounded-2xl font-bold text-xl shadow-lg hover:scale-[1.02] transition flex items-center justify-center gap-2"
        >
            {loading ? 'กำลังสร้างห้อง...' : <><Play fill="currentColor" /> เปิดห้องแข่งขัน</>}
        </button>

      </div>
    </div>
  );
};

export default GameSetup;
