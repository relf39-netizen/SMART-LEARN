

import React, { useState } from 'react';
import { Student } from '../types';
import { AlertCircle, GraduationCap, Loader2 } from 'lucide-react';
import { verifyStudentLogin } from '../services/api'; 

interface LoginProps {
  onLogin: (student: Student) => void;
  onTeacherLoginClick: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, onTeacherLoginClick }) => {
  const [inputCode, setInputCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false); 
  const [foundStudent, setFoundStudent] = useState<Student | null>(null);

  const handleNumberClick = (num: string) => {
    if (loading) return; 
    if (inputCode.length < 5) {
      const newCode = inputCode + num;
      setInputCode(newCode);
      setError('');
      
      if (newCode.length === 5) {
        checkStudent(newCode);
      }
    }
  };

  const handleBackspace = () => {
    if (loading) return;
    setInputCode(prev => prev.slice(0, -1));
    setError('');
    setFoundStudent(null);
  };

  const checkStudent = async (code: string) => {
    setLoading(true);
    
    // ✅ Updated API Call to handle object return
    const result = await verifyStudentLogin(code);
    
    setLoading(false);

    if (result.student) {
      setFoundStudent(result.student);
      setTimeout(() => {
        onLogin(result.student!);
      }, 1000);
    } else {
      setError(result.error || `ไม่พบข้อมูลรหัส ${code}`);
      setFoundStudent(null);
      setTimeout(() => {
        setInputCode('');
        setError('');
      }, 3000); // Increased timeout to read error
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] relative pb-10">
      <div className="bg-white p-6 md:p-8 rounded-[32px] shadow-2xl w-full max-w-md border-4 border-indigo-50 relative z-10">
        
        <div className="text-center mb-6">
          <div className="inline-block p-2 rounded-2xl mb-2 shadow-sm bg-white border border-indigo-50">
             <img src="https://img5.pic.in.th/file/secure-sv1/84826f0e65d9e89b36ed2ea9939f6d55.png" alt="Logo" className="w-20 h-20 object-contain" />
          </div>
          <h2 className="text-2xl font-bold text-indigo-900 mb-1">LittleSchool LearnUp</h2>
          <p className="text-indigo-600 font-medium text-sm mb-4">ก้าวเล็กๆ สู่ความสำเร็จที่ยิ่งใหญ่</p>
          <p className="text-gray-500 text-sm">พิมพ์รหัสประจำตัว 5 หลัก เพื่อเข้าเรียน</p>
        </div>

        <div className="bg-gray-50 rounded-2xl p-4 mb-6 h-24 flex items-center justify-center border border-gray-100 relative">
          {loading ? (
             <div className="flex flex-col items-center text-blue-500">
                 <Loader2 className="animate-spin mb-1" size={30} />
                 <span className="text-xs font-bold">กำลังตรวจสอบ...</span>
             </div>
          ) : foundStudent ? (
            <div className="flex flex-col items-center animate-bounce">
              <span className="text-4xl mb-1">{foundStudent.avatar}</span>
              <span className="text-lg font-bold text-green-600">{foundStudent.name}</span>
              {foundStudent.school && <span className="text-xs text-gray-500">{foundStudent.school}</span>}
            </div>
          ) : (
            <span className="text-5xl font-mono tracking-[0.5em] text-gray-400 font-bold pl-4">
              {inputCode.padEnd(5, '_')}
            </span>
          )}
        </div>

        {error && (
          <div className="flex items-center justify-center gap-2 text-red-500 mb-4 text-sm font-medium bg-red-50 p-2 rounded-lg animate-pulse text-center">
            <AlertCircle size={16} className="shrink-0" /> {error}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 md:gap-4 mb-8">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button key={num} onClick={() => handleNumberClick(num.toString())} className="bg-white border-2 border-indigo-100 shadow-[0_4px_0_0_rgba(224,231,255,1)] active:shadow-none active:translate-y-1 rounded-2xl p-3 md:p-4 text-2xl font-bold text-indigo-600 hover:border-indigo-300 transition-all">
              {num}
            </button>
          ))}
          <div className="col-span-1"></div>
          <button onClick={() => handleNumberClick('0')} className="bg-white border-2 border-indigo-100 shadow-[0_4px_0_0_rgba(224,231,255,1)] active:shadow-none active:translate-y-1 rounded-2xl p-3 md:p-4 text-2xl font-bold text-indigo-600 hover:border-indigo-300 transition-all">0</button>
          <button onClick={handleBackspace} className="bg-red-50 border-2 border-red-100 shadow-[0_4px_0_0_rgba(254,226,226,1)] active:shadow-none active:translate-y-1 rounded-2xl p-3 md:p-4 text-xl font-bold text-red-500 hover:border-red-200 transition-all">⌫</button>
        </div>
        
        {/* ปุ่มครูเข้าสู่ระบบ */}
        <div className="pt-6 border-t border-gray-100">
           <button 
             onClick={onTeacherLoginClick}
             className="w-full flex items-center justify-center gap-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 p-3 rounded-xl transition-colors group"
           >
              <div className="bg-gray-100 group-hover:bg-purple-100 p-2 rounded-full transition-colors text-gray-500 group-hover:text-purple-600">
                <GraduationCap size={20} />
              </div>
              <span className="font-bold text-sm">คุณครูเข้าสู่ระบบ (คลิกที่นี่)</span>
           </button>
        </div>
      </div>
    </div>
  );
};

export default Login;