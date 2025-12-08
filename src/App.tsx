

import React, { useState } from 'react';
import Layout from './components/Layout';
import Login from './views/Login';
import TeacherLogin from './views/TeacherLogin';
import TeacherDashboard from './views/TeacherDashboard';
import Dashboard from './views/Dashboard';
import PracticeMode from './views/PracticeMode';
import SubjectSelection from './views/SubjectSelection'; 
import GameMode from './views/GameMode';
import GameSetup from './views/GameSetup';
import Results from './views/Results';
import Stats from './views/Stats';
import { Student, Question, Teacher, Subject, ExamResult, Assignment, SubjectConfig } from './types';
import { saveScore, getDataForStudent, getQuestionsBySubject } from './services/api'; 
import { Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<Student | null>(null);
  const [currentTeacher, setCurrentTeacher] = useState<Teacher | null>(null);
  const [currentPage, setCurrentPage] = useState('login'); 
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [currentAssignment, setCurrentAssignment] = useState<Assignment | null>(null);
  const [isMusicOn, setIsMusicOn] = useState(true);
  
  // State to hold result data
  const [lastScore, setLastScore] = useState<{
      score: number, 
      total: number, 
      isHomework: boolean, 
      isGame: boolean,
      earnedToken?: boolean,
      unlockedReward?: string | null,
      leveledUp?: boolean
  } | null>(null);
  
  // ✅ New State for Game PIN
  const [gameRoomCode, setGameRoomCode] = useState<string>('');
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const [examResults, setExamResults] = useState<ExamResult[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [subjects, setSubjects] = useState<SubjectConfig[]>([]); 
  const [isLoading, setIsLoading] = useState(false); 

  // List of Possible Rewards
  const REWARD_POOL = [
      'ดาบอัศวิน', 'โล่ป้องกัน', 'หมวกพ่อมด', 'ตุ๊กตาหมี', 
      'เหรียญทองคำ', 'มงกุฎราชา', 'รองเท้าสายฟ้า', 'หนังสือเวทมนตร์'
  ];

  const handleLogin = async (student: Student) => { 
    setIsLoading(true);
    setCurrentUser(student); 
    
    try {
      const data = await getDataForStudent(student);
      setQuestions([]); // Questions will be loaded on demand
      setExamResults(data.results);
      setAssignments(data.assignments);
      setSubjects(data.subjects);
      
      setCurrentPage('dashboard'); 
    } catch (e) {
      console.error("Failed to load student data", e);
      alert("เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTeacherLoginSuccess = (teacher: Teacher) => { setCurrentTeacher(teacher); setCurrentPage('teacher-dashboard'); };
  const handleLogout = () => { 
      setCurrentUser(null); 
      setCurrentTeacher(null); 
      setCurrentPage('login'); 
      setSelectedSubject(null); 
      setCurrentAssignment(null);
      setGameRoomCode(''); 
      setSubjects([]);
      setQuestions([]); 
      setAssignments([]);
  };

  const handleFinishExam = async (score: number, total: number, source: 'practice' | 'game' = 'practice') => {
    if (!currentUser) return;
    
    const isHomework = !!currentAssignment;
    const isGame = source === 'game';
    const subjectToSave = currentAssignment ? currentAssignment.subject : (selectedSubject || 'รวมวิชา');
    
    // --- GAMIFICATION LOGIC ---
    let newQuizCount = (currentUser.quizCount || 0) + 1;
    let newTokens = currentUser.tokens || 0;
    let newLevel = currentUser.level || 1;
    let newInventory = [...(currentUser.inventory || [])];
    
    let earnedToken = false;
    let unlockedReward: string | null = null;
    let leveledUp = false;

    // 1. Every 5 quizzes -> Get 1 Token
    if (newQuizCount % 5 === 0) {
        newTokens += 1;
        earnedToken = true;
    }

    // 2. 6th quiz onwards: If Full Score -> Get 1 Token
    const isFullScore = score === total && total > 0;
    if (newQuizCount > 5 && isFullScore) {
        newTokens += 1;
        earnedToken = true; // Could be double token if matches rule #1 too
    }

    // 3. Level Up Condition: Every 5 Tokens
    if (newTokens >= 5) {
        // Exchange 5 tokens for 1 level up? Or Accumulate?
        // Prompt says: "Accumulate 5 stars -> Give reward".
        // Let's deduce 5 tokens to buy level up/reward.
        newTokens -= 5; 
        newLevel += 1;
        leveledUp = true;
        
        // Unlock Reward
        const randomReward = REWARD_POOL[Math.floor(Math.random() * REWARD_POOL.length)];
        // Add to inventory if not exists (or allow duplicates? let's allow duplicates for now or unique)
        if (!newInventory.includes(randomReward)) {
            newInventory.push(randomReward);
            unlockedReward = randomReward;
        } else {
             // Fallback reward
             unlockedReward = 'โพชั่นเพิ่มพลัง';
             newInventory.push('โพชั่นเพิ่มพลัง');
        }
    }

    setLastScore({ score, total, isHomework, isGame, earnedToken, unlockedReward, leveledUp });
    setCurrentPage('results');
    
    // Update Local State
    const updatedStudent = { 
        ...currentUser, 
        stars: currentUser.stars + score, // Existing logic (score = XP)
        quizCount: newQuizCount,
        tokens: newTokens, // The remaining tokens after leveling up
        level: newLevel,
        inventory: newInventory
    };
    setCurrentUser(updatedStudent);

    if (isGame) {
         // Game doesn't save results to permanent history usually, but we might want to update stats?
         // For now, prompt says game gives stars too. Let's update stats but NOT examResult history to avoid clutter.
         // Actually, let's just update the Student Stats in Firebase.
         await saveScore(
            currentUser.id, 
            currentUser.name, 
            currentUser.school || '-', 
            score, // Adds to existing stars
            total, 
            'GAME_MODE', // Fake subject for game
            undefined,
            { quizCount: newQuizCount, tokens: newTokens, level: newLevel, inventory: newInventory }
         );
         return; 
    }

    // Normal Save
    await saveScore(
         currentUser.id, 
         currentUser.name, 
         currentUser.school || '-', 
         score, 
         total, 
         subjectToSave, 
         currentAssignment ? currentAssignment.id : undefined,
         { quizCount: newQuizCount, tokens: newTokens, level: newLevel, inventory: newInventory }
    );
       
    const newResult: ExamResult = { 
         id: Math.random().toString(), 
         studentId: currentUser.id, 
         subject: subjectToSave as Subject,
         score: score, 
         totalQuestions: total, 
         timestamp: Date.now(), 
         assignmentId: currentAssignment?.id 
    };
    setExamResults(prev => [...prev, newResult]);
    setCurrentAssignment(null);
  };

  // ✅ Optimized: Fetch questions on demand
  const handleSelectSubject = async (subject: Subject) => { 
    setIsLoading(true);
    try {
        const fetchedQuestions = await getQuestionsBySubject(subject);
        setQuestions(fetchedQuestions);
        setSelectedSubject(subject); 
        setCurrentAssignment(null); 
        setCurrentPage('practice'); 
    } catch(e) {
        console.error(e);
        alert('เกิดข้อผิดพลาดในการโหลดข้อสอบ');
    } finally {
        setIsLoading(false);
    }
  };
  
  // ✅ Optimized: Fetch questions on demand
  const handleStartAssignment = async (assignment: Assignment) => { 
    setIsLoading(true);
    try {
        const fetchedQuestions = await getQuestionsBySubject(assignment.subject);
        setQuestions(fetchedQuestions);
        setCurrentAssignment(assignment); 
        setSelectedSubject(assignment.subject); 
        setCurrentPage('practice');
    } catch (e) {
        console.error(e);
        alert('เกิดข้อผิดพลาดในการโหลดข้อสอบ');
    } finally {
        setIsLoading(false);
    }
  };

  const handleGameCreated = (roomCode: string) => {
      setGameRoomCode(roomCode);
      setCurrentPage('teacher-game');
  };

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-blue-50 text-blue-600">
      <Loader2 className="animate-spin mb-4" size={48} />
      <p className="text-lg font-bold">กำลังเตรียมข้อมูล...</p>
    </div>
  );

  if (currentPage === 'teacher-login') return <TeacherLogin onLoginSuccess={handleTeacherLoginSuccess} onBack={() => setCurrentPage('login')} />;
  if (currentPage === 'teacher-dashboard' && currentTeacher) return <TeacherDashboard teacher={currentTeacher} onLogout={handleLogout} onStartGame={() => setCurrentPage('game-setup')} onAdminLoginAsStudent={handleLogin} />;
  
  if (currentPage === 'game-setup' && currentTeacher) return <GameSetup teacher={currentTeacher} onBack={() => setCurrentPage('teacher-dashboard')} onGameCreated={handleGameCreated} />;
  
  if (currentPage === 'teacher-game' && currentTeacher) {
      const teacherAsStudent: Student = { id: '99999', name: currentTeacher.name, school: currentTeacher.school, avatar: '👨‍🏫', stars: 0, grade: 'TEACHER' };
      return <GameMode student={teacherAsStudent} initialRoomCode={gameRoomCode} onExit={() => setCurrentPage('teacher-dashboard')} />;
  }
  
  if (currentPage === 'login' && !currentUser) return <Login onLogin={handleLogin} onTeacherLoginClick={() => setCurrentPage('teacher-login')} />;

  return (
    <Layout studentName={currentUser?.name} onLogout={handleLogout} isMusicOn={isMusicOn} toggleMusic={() => setIsMusicOn(!isMusicOn)} currentPage={currentPage} onNavigate={setCurrentPage}>
      {(() => {
        switch (currentPage) {
          case 'dashboard': 
            return <Dashboard 
              student={currentUser!} 
              assignments={assignments} 
              examResults={examResults} 
              subjects={subjects} 
              onNavigate={setCurrentPage} 
              onStartAssignment={handleStartAssignment}
              onSelectSubject={handleSelectSubject}
              onRefreshSubjects={() => handleLogin(currentUser!)} 
            />;
          case 'select-subject': return <SubjectSelection onSelectSubject={handleSelectSubject} onBack={() => setCurrentPage('dashboard')} />;
          case 'practice':
            let qList = questions;
            if (currentUser) {
                // ✅ Filter loaded questions locally for practice mode
                qList = questions.filter(q => 
                    (q.grade === currentUser.grade || q.grade === 'ALL') &&
                    (q.school === currentUser.school || q.school === 'CENTER' || q.school === 'Admin')
                );
            }
            // Assignment already sets `questions` correctly in `handleStartAssignment`, but filtering doesn't hurt
            if (currentAssignment) {
                 qList = qList.slice(0, currentAssignment.questionCount); // Take only needed amount if more loaded
            }
            return <PracticeMode questions={qList} onFinish={(s, t) => handleFinishExam(s, t, 'practice')} onBack={() => setCurrentPage('dashboard')} />;
          
          case 'game': 
            return (
                <GameMode 
                    student={currentUser!} 
                    onExit={() => setCurrentPage('dashboard')} 
                    onFinish={(score, total) => handleFinishExam(score, total, 'game')}
                />
            );
          
          case 'results': 
            return <Results 
                score={lastScore?.score || 0} 
                total={lastScore?.total || 0} 
                isHomework={lastScore?.isHomework} 
                isGame={lastScore?.isGame} 
                earnedToken={lastScore?.earnedToken}
                unlockedReward={lastScore?.unlockedReward}
                leveledUp={lastScore?.leveledUp}
                onRetry={() => setCurrentPage('dashboard')} 
                onHome={() => setCurrentPage('dashboard')} 
            />;
          case 'stats': 
            return <Stats 
              examResults={examResults} 
              studentId={currentUser!.id} 
              subjects={subjects} 
              onBack={() => setCurrentPage('dashboard')} 
            />;
          default: return <Dashboard student={currentUser!} onNavigate={setCurrentPage} subjects={subjects} onSelectSubject={handleSelectSubject} />;
        }
      })()}
    </Layout>
  );
};
export default App;