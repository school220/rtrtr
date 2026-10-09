import React from 'react';
import { Home, ShieldCheck, FileCheck, GraduationCap, Building2 } from 'lucide-react';
import { StudentStateResponse } from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.js';
import { LanguageSelector } from '../components/LanguageSelector.js';

interface StudentResultProps {
  state: StudentStateResponse;
  onHome: () => void;
  onNewTest?: () => void;
  isProctorPreview?: boolean;
  onExitPreview?: () => void;
}

export const StudentResult: React.FC<StudentResultProps> = ({
  state,
  onHome,
  onNewTest,
  isProctorPreview = false,
  onExitPreview,
}) => {
  const { t } = useLanguage();
  const report = state.scoreReport;
  const student = state.student;

  const grade = report?.grade ?? 2;
  const percentage = report?.percentage ?? 0;
  const correct = report?.correctAnswers ?? 0;
  const total = report?.totalQuestions ?? 20;

  const gradeTitle =
    grade === 5
      ? t.resultGrade5
      : grade === 4
      ? t.resultGrade4
      : grade === 3
      ? t.resultGrade3
      : t.resultGrade2;

  const gradeColor =
    grade === 5
      ? 'text-emerald-700 border-emerald-300 bg-emerald-50'
      : grade === 4
      ? 'text-blue-700 border-blue-300 bg-blue-50'
      : grade === 3
      ? 'text-amber-700 border-amber-300 bg-amber-50'
      : 'text-rose-700 border-rose-300 bg-rose-50';

  return (
    <div className="min-h-screen bg-[#f4f6f9] text-[#222d32] flex flex-col font-sans select-none">
      {/* Top Header */}
      <header className="bg-[#25718f] text-white h-14 flex items-center justify-between px-4 sm:px-6 shadow-sm sticky top-0 z-40">
        <div className="flex items-center gap-2 font-bold text-base">
          <GraduationCap className="w-5 h-5 text-cyan-200" />
          <span>{isProctorPreview ? t.proctorBannerTitle : t.resultHeader}</span>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono text-cyan-100">
          <div className="hidden sm:flex items-center gap-1.5">
            <Building2 className="w-4 h-4" />
            <span>{t.resultHeaderSub}</span>
          </div>
          <LanguageSelector />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md space-y-4 animate-in zoom-in-95 duration-300">
          {/* Official Result Card */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 p-4 text-center">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-cyan-50 border border-cyan-200 text-[#25718f] text-xs font-mono font-bold tracking-wider">
                <FileCheck className="w-4 h-4 text-[#25718f]" />
                <span>{isProctorPreview ? 'PROKTOR TEKSHIRUVI / КОМИССИЯ' : t.resultBadge}</span>
              </div>
              <h2 className="text-xl font-black text-gray-800 uppercase tracking-tight mt-1">
                {t.resultHeading}
              </h2>
              <div className="text-sm font-bold text-gray-900 font-mono mt-1">
                {student.lastName} {student.firstName}
              </div>
              <div className="text-xs text-gray-500 font-mono">
                {t.resultStudentId} #{String(student.studentId).padStart(2, '0')} • {t.resultVariant}{String(student.formId).padStart(2, '0')}
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Grade Display */}
              <div className={`p-5 rounded border text-center space-y-1 ${gradeColor}`}>
                <span className="block text-[11px] font-mono font-bold uppercase tracking-widest text-gray-600">
                  {t.resultGradeTitle}
                </span>
                <div className="text-5xl font-black font-mono tracking-tight flex items-baseline justify-center gap-1">
                  <span>{grade}</span>
                  <span className="text-xl text-gray-500 font-semibold">/ 5</span>
                </div>
                <div className="text-xs font-bold font-mono tracking-wider uppercase">
                  {gradeTitle}
                </div>
              </div>

              {/* Points Breakdown */}
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-3.5 rounded bg-gray-50 border border-gray-200 space-y-1">
                  <span className="text-[10px] font-mono font-semibold text-gray-500 uppercase tracking-wider block">
                    {t.resultCorrect}
                  </span>
                  <div className="text-xl font-black text-gray-900 font-mono">
                    {correct} <span className="text-xs text-gray-500 font-normal">/ {total}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded bg-gray-50 border border-gray-200 space-y-1">
                  <span className="text-[10px] font-mono font-semibold text-gray-500 uppercase tracking-wider block">
                    {t.resultPercentage}
                  </span>
                  <div className="text-xl font-black text-[#25718f] font-mono">
                    {percentage}%
                  </div>
                </div>
              </div>

              {/* Verification Statement */}
              <div className="p-3 bg-gray-50 border border-gray-200 rounded text-xs font-mono text-gray-700 space-y-1 text-left">
                <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>{t.resultVerifiedTitle}</span>
                </div>
                <div>{t.resultVerified1}</div>
                <div>{t.resultVerified2}</div>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                {isProctorPreview && onExitPreview ? (
                  <button
                    onClick={onExitPreview}
                    className="w-full py-3 px-6 rounded bg-[#25718f] hover:bg-[#1f5f79] text-white font-bold font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow"
                  >
                    <Home className="w-4 h-4" />
                    <span>{t.resultBackToTeacherBtn}</span>
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        localStorage.removeItem('student_session_token');
                        localStorage.removeItem('student_game_code');
                        localStorage.removeItem('student_game_id');
                        localStorage.removeItem('student_id');
                        localStorage.removeItem('student_form_id');
                        localStorage.removeItem('student_first_name');
                        localStorage.removeItem('student_last_name');
                        if (onNewTest) {
                          onNewTest();
                        } else {
                          onHome();
                        }
                      }}
                      className="w-full py-3 px-6 rounded bg-[#00a65a] hover:bg-emerald-700 text-white font-bold font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow"
                    >
                      <FileCheck className="w-4 h-4" />
                      <span>{t.resultStartNewBtn}</span>
                    </button>

                    <button
                      onClick={() => {
                        localStorage.removeItem('student_session_token');
                        localStorage.removeItem('student_game_code');
                        localStorage.removeItem('student_game_id');
                        localStorage.removeItem('student_id');
                        localStorage.removeItem('student_form_id');
                        localStorage.removeItem('student_first_name');
                        localStorage.removeItem('student_last_name');
                        onHome();
                      }}
                      className="w-full py-2.5 px-6 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
                    >
                      <Home className="w-4 h-4" />
                      <span>{t.resultBackBtn}</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
