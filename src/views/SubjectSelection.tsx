
import React, { useEffect, useState } from 'react';
import { Subject, SubjectConfig } from '../types';
import { Calculator, Book, FlaskConical, Languages, ArrowLeft, Users, Gamepad2, Sparkles } from 'lucide-react';
import { getSubjects } from '../services/api';

interface SubjectSelectionProps {
  onSelectSubject: (subject: Subject) => void;
  onBack: () => void;
}

const SubjectSelection: React.FC<SubjectSelectionProps> = ({ onSelectSubject, onBack }) => {
  const [subjects, setSubjects] = useState<SubjectConfig[]>([]);
  const [loading, setLoading] = useState(true);

  // Icon Mapping
  const getIcon = (iconName: string) => {
      switch(iconName) {
          case 'Book': return <Book size={48} />;
          case 'Calculator': return <Calculator size={48} />;
          case 'FlaskConical': return <FlaskConical size={48} />;
          case 'Languages': return <Languages size={48} />;
          case 'Globe': return <Users size={48} />;
          case 'Computer': return <Gamepad2 size={48} />;
          default: return <Sparkles size={48} />;
      }
  };

  useEffect(() => {
      const loadSubjects = async () => {
          // In a real app, we would get the school from the logged-in student context.
          // For now, assuming a default school or fetching all available.
          // Since the API requires school, we'll try to get it from local storage or context if passed, 
          // or just fetch from a known school for demo.
          // Fallback: We'll fetch from 'โรงเรียนคุณภาพ' which is the default for MOCK_STUDENTS
          const data = await getSubjects('โรงเรียนคุณภาพ'); 
          setSubjects(data);
          setLoading(false);
      };
      loadSubjects();
  }, []);

  return (
    <div className="max-w-3xl mx-auto min-h-[80vh] flex flex-col">
      <button onClick={onBack} className="text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-6 w-fit">
        <ArrowLeft size={20} /> กลับหน้าหลัก
      </button>

      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">เลือกวิชาที่ต้องการฝึก</h2>
        <p className="text-gray-500">เลือกวิชาแล้วเริ่มทำแบบทดสอบกันเลย!</p>
      </div>

      {loading ? (
          <div className="text-center py-20 text-gray-400">กำลังโหลดรายวิชา...</div>
      ) : subjects.length === 0 ? (
          <div className="text-center py-20 text-gray-400 border-2 border-dashed rounded-3xl">
              ยังไม่มีรายวิชาที่เปิดให้ฝึกฝน
          </div>
      ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {subjects.map((sub) => (
              <button
                key={sub.id}
                onClick={() => onSelectSubject(sub.name)}
                className={`group relative p-8 rounded-3xl border-4 transition-all duration-300 transform hover:-translate-y-2 hover:shadow-xl flex flex-col items-center gap-4 bg-white border-blue-100 hover:border-blue-400 text-blue-800 shadow-blue-50`}
              >
                <div className="bg-blue-50 p-4 rounded-full shadow-sm group-hover:scale-110 transition-transform text-blue-600">
                  {getIcon(sub.icon)}
                </div>
                <h3 className="text-2xl font-bold">{sub.name}</h3>
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="bg-blue-100 px-3 py-1 rounded-full text-xs font-bold text-blue-700 shadow-sm">
                    เริ่มเลย!
                  </span>
                </div>
              </button>
            ))}
          </div>
      )}
    </div>
  );
};

export default SubjectSelection;
