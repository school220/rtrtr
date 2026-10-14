import React, { useState } from 'react';
import {
  Menu,
  Bell,
  User,
  BookOpen,
  Calendar,
  Award,
  CheckCircle2,
  FileText,
  GraduationCap,
  ChevronRight,
  Minus,
  Plus,
  ShieldCheck,
  Building2,
  ExternalLink,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.js';
import { LanguageSelector } from '../components/LanguageSelector.js';

interface HomeProps {
  onSelectRole: (role: 'student' | 'teacher' | 'import') => void;
}

export const Home: React.FC<HomeProps> = ({ onSelectRole }) => {
  const { t } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [section1Open, setSection1Open] = useState(true);
  const [section2Open, setSection2Open] = useState(true);

  return (
    <div className="min-h-screen bg-[#f4f6f9] text-[#222d32] font-sans flex flex-col select-none">
      {/* Top Navbar - HEMIS Style */}
      <header className="bg-[#25718f] text-white h-14 flex items-center justify-between px-3 sm:px-5 shadow-sm sticky top-0 z-40">
        <div className="flex items-center gap-3">
          {/* Logo brand */}
          <div className="flex items-center gap-2 font-bold text-lg tracking-wide">
            <GraduationCap className="w-6 h-6 text-cyan-200" />
            <span className="font-extrabold tracking-tight">{t.brand}</span>
          </div>
          {/* Hamburger toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded hover:bg-[#1f5f79] text-white/90 hover:text-white transition-colors"
            title={t.toggleMenuTitle || "Menyuni ochish/yopish"}
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {/* Right tools: Language, Bell, User Profile */}
        <div className="flex items-center gap-2 sm:gap-4 text-xs font-medium">
          {/* University Badge */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#1f5f79] text-white/90 border border-white/10 font-mono">
            <Building2 className="w-3.5 h-3.5 text-cyan-200" />
            <span>{t.universityBadge}</span>
          </div>

          {/* Interactive Language Selector (O'zbekcha / Русский) */}
          <LanguageSelector />

          {/* Notifications */}
          <div className="relative cursor-pointer p-1.5 hover:text-cyan-200">
            <Bell className="w-4 h-4" />
            <span className="absolute top-0.5 right-0.5 bg-[#f39c12] text-white text-[10px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center font-mono">
              0
            </span>
          </div>

          {/* Student Profile Avatar */}
          <div className="flex items-center gap-2 pl-2 border-l border-white/20">
            <div className="w-8 h-8 rounded-full bg-white/20 border border-white/30 flex items-center justify-center text-white">
              <User className="w-4 h-4" />
            </div>
            <div className="hidden sm:block text-left leading-tight">
              <div className="font-bold text-[11px] text-white">{t.userRole}</div>
              <div className="text-[10px] text-cyan-100 font-mono">{t.activeYear}</div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Body with Sidebar */}
      <div className="flex flex-1">
        {/* Left Sidebar - HEMIS Dark (#222d32) */}
        <aside
          className={`${
            sidebarOpen ? 'w-56' : 'w-0 sm:w-56'
          } bg-[#222d32] text-[#b8c7ce] text-xs transition-all duration-200 overflow-hidden shrink-0 flex flex-col border-r border-[#1a2226]`}
        >
          {/* User badge inside sidebar */}
          <div className="p-3 bg-[#1a2226] flex items-center gap-2.5 border-b border-[#2c3b41]">
            <div className="w-8 h-8 rounded-full bg-[#25718f] text-white flex items-center justify-center font-bold">
              H
            </div>
            <div className="leading-tight">
              <div className="text-white font-bold text-[11px]">{t.systemTitleShort || "HEMIS Tizimi"}</div>
              <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>{t.onlineStatus}</span>
              </div>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="p-2 space-y-1 font-medium">
            <div className="text-[10px] uppercase font-bold text-slate-500 px-3 py-1 tracking-wider">
              {t.mainMenu}
            </div>

            <button
              onClick={() => onSelectRole('student')}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded bg-[#1e282c] text-white border-l-2 border-[#00c0ef] font-semibold text-left"
            >
              <FileText className="w-4 h-4 text-[#00c0ef]" />
              <span>{t.menuTakeExam}</span>
            </button>

            <div className="text-[10px] uppercase font-bold text-slate-500 px-3 py-2 tracking-wider mt-2">
              {t.infoSection}
            </div>

            <div className="flex items-center gap-2.5 px-3 py-2 rounded text-[#8aa4af] hover:text-white cursor-pointer">
              <Calendar className="w-4 h-4" />
              <span>{t.menuSchedule}</span>
            </div>

            <div className="flex items-center gap-2.5 px-3 py-2 rounded text-[#8aa4af] hover:text-white cursor-pointer">
              <Award className="w-4 h-4" />
              <span>{t.menuGradeBook}</span>
            </div>

            <div className="flex items-center gap-2.5 px-3 py-2 rounded text-[#8aa4af] hover:text-white cursor-pointer">
              <ShieldCheck className="w-4 h-4" />
              <span>{t.menuRules}</span>
            </div>
          </nav>
        </aside>

        {/* Content Area */}
        <main className="flex-1 p-3 sm:p-5 space-y-4 max-w-7xl mx-auto w-full">
          {/* Breadcrumbs bar */}
          <div className="flex items-center justify-between text-xs text-gray-500 pb-1">
            <div className="flex items-center gap-1 font-mono">
              <span className="hover:text-gray-700 cursor-pointer">🏠 {t.breadcrumbsHome}</span>
              <span>/</span>
              <span className="text-gray-800 font-bold">{t.breadcrumbsExam}</span>
            </div>
            <div className="hidden sm:block text-[11px] text-gray-500">
              {t.systemVersionSubtitle || "HEMIS v2.4 • Oliy ta'lim jarayonlarini boshqarish axborot tizimi"}
            </div>
          </div>

          {/* Semester & Student Status Banner (Matches screenshot) */}
          <div className="bg-white rounded border border-gray-200 shadow-sm p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-emerald-600/10 text-emerald-600 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs text-gray-500 font-mono">{t.statusLabel}</div>
                <div className="text-sm sm:text-base font-bold text-gray-800 flex items-center gap-2">
                  <span>{t.statusValue}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold font-mono">
                    {t.activeExamBadge}
                  </span>
                </div>
              </div>
            </div>

            {/* Semester selector bar */}
            <div className="flex items-center gap-1 sm:gap-2 text-xs font-mono">
              <span className="text-gray-500 font-semibold mr-1">{t.semesterBar}</span>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                <span
                  key={s}
                  className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${
                    s === 5
                      ? 'bg-[#00a65a] text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 cursor-pointer'
                  }`}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>

          {/* Section 1: Main Examination Launch Cards */}
          <div className="bg-white rounded border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">
              <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                <span>{t.section1Title}</span>
              </h2>
              <button
                onClick={() => setSection1Open(!section1Open)}
                className="text-gray-400 hover:text-gray-600"
              >
                {section1Open ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              </button>
            </div>

            {section1Open && (
              <div className="p-4 sm:p-6">
                <div
                  onClick={() => onSelectRole('student')}
                  className="group bg-gradient-to-r from-cyan-50/60 via-white to-sky-50/60 hover:from-cyan-100/50 hover:to-sky-100/50 border-2 border-cyan-300 hover:border-[#00c0ef] rounded-xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 cursor-pointer transition-all shadow-sm hover:shadow-md"
                >
                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
                    <div className="w-20 h-20 rounded-2xl bg-[#00c0ef] text-white flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform shrink-0">
                      <FileText className="w-10 h-10" />
                    </div>
                    <div>
                      <div className="flex items-center justify-center sm:justify-start gap-2">
                        <span className="text-[11px] font-mono uppercase tracking-widest text-[#25718f] font-bold bg-cyan-100/70 px-2.5 py-0.5 rounded">
                          {t.finalControlBadge || "YAKUNIY DAVLAT NAZORATI"}
                        </span>
                        <span className="text-[10px] font-mono text-emerald-700 bg-emerald-100 font-bold px-2 py-0.5 rounded">
                          {t.activeTestBadge || "FAOL SINOV"}
                        </span>
                      </div>
                      <h3 className="font-black text-lg sm:text-xl text-gray-800 uppercase tracking-tight mt-1.5">
                        {t.studentCardTitle}
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-600 mt-1 max-w-xl leading-relaxed">
                        {t.studentCardDesc}. {t.studentCardFullDesc}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 w-full sm:w-auto">
                    <div className="w-full sm:w-auto px-6 py-3.5 rounded-lg bg-[#25718f] group-hover:bg-[#1f5f79] text-white text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-all">
                      <span>{t.studentCardBtn}</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Fanlar va resurslar */}
          <div className="bg-white rounded border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">
              <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                {t.section2Title}
              </h2>
              <button
                onClick={() => setSection2Open(!section2Open)}
                className="text-gray-400 hover:text-gray-600"
              >
                {section2Open ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              </button>
            </div>

            {section2Open && (
              <div className="p-4 sm:p-6 grid grid-cols-2 sm:grid-cols-6 gap-4 text-center">
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-[#a07455] text-white flex items-center justify-center shadow-sm mb-2">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-semibold text-gray-700">{t.curriculum}</span>
                </div>

                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-[#3c8dbc] text-white flex items-center justify-center shadow-sm mb-2">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-semibold text-gray-700">{t.timetable}</span>
                </div>

                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-[#00a65a] text-white flex items-center justify-center shadow-sm mb-2">
                    <Award className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-semibold text-gray-700">{t.controlSchedule}</span>
                </div>

                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-[#dd4b39] text-white flex items-center justify-center shadow-sm mb-2">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-semibold text-gray-700">{t.proctoringRules}</span>
                </div>

                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-[#f39c12] text-white flex items-center justify-center shadow-sm mb-2">
                    <FileText className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-semibold text-gray-700">{t.subjectResources}</span>
                </div>

                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-[#e08e0b] text-white flex items-center justify-center shadow-sm mb-2">
                    <ExternalLink className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-semibold text-gray-700">{t.unilibrary}</span>
                </div>
              </div>
            )}
          </div>

          {/* Academic Footer */}
          <footer className="text-center text-xs text-gray-500 pt-4 pb-2 border-t border-gray-200">
            <div className="font-semibold text-gray-700">
              {t.systemFooter}
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5 font-mono">
              {t.allRightsReserved}
            </div>
          </footer>
        </main>
      </div>

      {/* Toast Notification */}
      <div className="fixed bottom-4 right-4 z-50 bg-[#5cb85c] text-white px-4 py-2.5 rounded shadow-lg text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-bottom-3 duration-300">
        <CheckCircle2 className="w-4 h-4" />
        <span>{t.toastSuccess}</span>
      </div>
    </div>
  );
};
