import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Upload,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FileText,
  Database,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Save,
  Eye,
  EyeOff,
  Check,
  Play,
} from 'lucide-react';
import { api, FormDetailResponse } from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.js';
import { LanguageSelector } from '../components/LanguageSelector.js';
import { MathRenderer } from '../components/MathRenderer.js';

interface TeacherImportProps {
  onBack: () => void;
  onStartProctorPreview?: (formId: number) => void;
}

export const TeacherImport: React.FC<TeacherImportProps> = ({ onBack, onStartProctorPreview }) => {
  const { t } = useLanguage();
  const [formsStatus, setFormsStatus] = useState<any[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<number>(1);
  const [currentForm, setCurrentForm] = useState<FormDetailResponse | null>(null);
  const [editedQuestions, setEditedQuestions] = useState<any[]>([]);
  const [formTitle, setFormTitle] = useState('');

  const [loadingStatus, setLoadingStatus] = useState(false);
  const [loadingForm, setLoadingForm] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [savingQuestionId, setSavingQuestionId] = useState<number | null>(null);
  const [savedQuestionIds, setSavedQuestionIds] = useState<Record<number, boolean>>({});

  const [previewMath, setPreviewMath] = useState(true);
  const [showRawJson, setShowRawJson] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [importingJson, setImportingJson] = useState(false);
  const [resultMessage, setResultMessage] = useState<{ success: boolean; message: string } | null>(null);

  // Load status and initial form on mount
  useEffect(() => {
    loadStatus();
    loadFormDetail(1);
  }, []);

  const loadStatus = async () => {
    setLoadingStatus(true);
    try {
      const res = await api.getFormsStatus();
      setFormsStatus(res.forms || []);
    } catch {
      // ignore
    } finally {
      setLoadingStatus(false);
    }
  };

  const cleanDisplayOption = (text: string): string => {
    if (!text) return '';
    const m = text.match(/^\$([0-9.,\s+-]+)\$$/);
    if (m) {
      return m[1].trim();
    }
    return text;
  };

  const loadFormDetail = async (formId: number) => {
    setLoadingForm(true);
    setSelectedFormId(formId);
    setResultMessage(null);
    try {
      const data = await api.getFormDetail(formId);
      setCurrentForm(data);
      setFormTitle(data.title || `${formId}-variant`);
      const cleaned = (data.questions || []).map((q: any) => ({
        ...q,
        options: (q.options || []).map((opt: any) => ({
          ...opt,
          text: cleanDisplayOption(opt.text),
        })),
      }));
      setEditedQuestions(cleaned);
    } catch (err: any) {
      setResultMessage({
        success: false,
        message: err.message || `Variant №${formId} ma'lumotlarini yuklashda xatolik`,
      });
    } finally {
      setLoadingForm(false);
    }
  };

  const handleLogout = async () => {
    await api.teacherLogout();
    onBack();
  };

  // Modify question field
  const handleUpdateQuestion = (qIndex: number, field: string, value: any) => {
    setEditedQuestions((prev) => {
      const copy = [...prev];
      copy[qIndex] = { ...copy[qIndex], [field]: value };
      return copy;
    });
  };

  // Modify option text
  const handleUpdateOptionText = (qIndex: number, optIndex: number, text: string) => {
    setEditedQuestions((prev) => {
      const copy = [...prev];
      const q = { ...copy[qIndex] };
      const opts = [...(q.options || [])];
      opts[optIndex] = { ...opts[optIndex], text };
      q.options = opts;
      copy[qIndex] = q;
      return copy;
    });
  };

  // Choose correct option for multiple choice
  const handleSelectCorrectOption = (qIndex: number, label: string) => {
    setEditedQuestions((prev) => {
      const copy = [...prev];
      const q = { ...copy[qIndex] };
      q.correct_answer = label;
      q.options = (q.options || []).map((opt: any) => ({
        ...opt,
        is_correct: opt.label === label,
      }));
      copy[qIndex] = q;
      return copy;
    });
  };

  // Save single question
  const handleSaveQuestion = async (qIndex: number) => {
    const q = editedQuestions[qIndex];
    if (!q || !q.id) return;

    setSavingQuestionId(q.id);
    try {
      await api.updateQuestion(q.id, {
        text: q.text,
        correct_answer: q.correct_answer,
        explanation: q.explanation || '',
        options: q.options || [],
      });

      setSavedQuestionIds((prev) => ({ ...prev, [q.id]: true }));
      setTimeout(() => {
        setSavedQuestionIds((prev) => {
          const next = { ...prev };
          delete next[q.id];
          return next;
        });
      }, 3000);
    } catch (err: any) {
      alert(err.message || 'Xatolik yuz berdi');
    } finally {
      setSavingQuestionId(null);
    }
  };

  // Save all 20 questions in current variant
  const handleSaveEntireForm = async () => {
    if (!currentForm) return;
    setSavingAll(true);
    setResultMessage(null);

    try {
      const payload = {
        form_id: selectedFormId,
        title: formTitle,
        questions: editedQuestions.map((q) => ({
          number: q.number,
          type: q.type,
          text: q.text,
          correct_answer: q.correct_answer,
          explanation: q.explanation || '',
          options: q.options || [],
        })),
      };

      const res = await api.importForm(payload);
      setResultMessage({ success: true, message: res.message });
      await loadStatus();
      await loadFormDetail(selectedFormId);
    } catch (err: any) {
      setResultMessage({
        success: false,
        message: err.message || 'Variantni saqlashda xatolik',
      });
    } finally {
      setSavingAll(false);
    }
  };

  // Raw JSON import
  const handleImportJson = async () => {
    setResultMessage(null);
    setImportingJson(true);

    try {
      const parsed = JSON.parse(jsonText);
      const res = await api.importForm(parsed);
      setResultMessage({ success: true, message: res.message });
      setJsonText('');
      await loadStatus();
      if (parsed.form_id) {
        await loadFormDetail(parsed.form_id);
      }
    } catch (err: any) {
      setResultMessage({ success: false, message: err.message || 'JSON strukturasi xato' });
    } finally {
      setImportingJson(false);
    }
  };

  const insertTemplate = () => {
    const template = {
      form_id: selectedFormId,
      title: `${selectedFormId}-variant (Matematika 4-sinf)`,
      questions: editedQuestions.slice(0, 2).map((q) => ({
        number: q.number,
        type: q.type,
        text: q.text,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        options: q.options,
      })),
    };
    setJsonText(JSON.stringify(template, null, 2));
  };

  const completeCount = formsStatus.filter((f) => f.isComplete).length;

  return (
    <div className="min-h-screen bg-[#f4f6f9] text-[#222d32] p-3 sm:p-5 select-none max-w-6xl mx-auto space-y-4 font-sans">
      {/* Top Header Card */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-5 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
            title="Ortga"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold tracking-wider uppercase text-[#25718f] bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded font-mono">
                {t.importBadge}
              </span>
              <span className="text-xs font-mono text-gray-500">
                {completeCount} / 50 {t.importCompletedText}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight mt-0.5">
              {t.importHeading}
            </h1>
            <p className="text-xs text-gray-500 font-mono">
              {t.importDesc}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <LanguageSelector />
          <button
            onClick={() => {
              loadStatus();
              loadFormDetail(selectedFormId);
            }}
            disabled={loadingStatus || loadingForm}
            className="p-2.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
            title="Yangilash / Обновить"
          >
            <RefreshCw className={`w-4 h-4 ${loadingStatus || loadingForm ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleLogout}
            className="p-2.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors flex items-center gap-1.5 text-xs font-mono font-semibold"
            title="Chiqish / Выход"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Chiqish</span>
          </button>
        </div>
      </div>

      {/* Global Alert Message */}
      {resultMessage && (
        <div
          className={`p-3.5 rounded border text-xs flex items-start gap-2.5 font-medium animate-in fade-in ${
            resultMessage.success
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {resultMessage.success ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          )}
          <span>{resultMessage.message}</span>
        </div>
      )}

      {/* Variant Selection Grid (1 to 50) */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-[#25718f]" />
            <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">
              {t.editorSelectVariant}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={selectedFormId <= 1}
              onClick={() => loadFormDetail(selectedFormId - 1)}
              className="p-1.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title={t.editorPrevVariant}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono font-bold text-xs px-2 text-[#25718f]">
              № {selectedFormId} / 50
            </span>
            <button
              disabled={selectedFormId >= 50}
              onClick={() => loadFormDetail(selectedFormId + 1)}
              className="p-1.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title={t.editorNextVariant}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 50 Quick Variant Buttons */}
        <div className="grid grid-cols-5 sm:grid-cols-10 md:grid-cols-25 gap-1.5 max-h-36 overflow-y-auto p-1">
          {Array.from({ length: 50 }, (_, i) => i + 1).map((fId) => {
            const isSelected = fId === selectedFormId;
            return (
              <button
                key={fId}
                onClick={() => loadFormDetail(fId)}
                className={`py-1.5 px-1 rounded text-xs font-mono font-bold transition-all text-center ${
                  isSelected
                    ? 'bg-[#25718f] text-white shadow-sm ring-2 ring-[#25718f]/40 scale-105'
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200'
                }`}
              >
                №{String(fId).padStart(2, '0')}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Form Inspector & Editor */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-5 shadow-sm space-y-4">
        {/* Editor Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div className="space-y-1 flex-1 min-w-[260px]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 font-mono">
              KIM Varianti №{selectedFormId}
            </span>
            <input
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="w-full text-base sm:text-lg font-bold text-gray-900 border-b border-gray-300 focus:border-[#25718f] focus:outline-none bg-transparent"
              placeholder="Variant nomi..."
            />
          </div>

          <div className="flex items-center gap-2">
            {/* KaTeX formula preview toggle */}
            <button
              onClick={() => setPreviewMath(!previewMath)}
              className={`p-2.5 rounded text-xs font-semibold flex items-center gap-1.5 border transition-colors ${
                previewMath
                  ? 'bg-cyan-50 text-[#25718f] border-cyan-200'
                  : 'bg-gray-50 text-gray-600 border-gray-200'
              }`}
              title={t.editorPreviewToggle}
            >
              {previewMath ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              <span className="hidden sm:inline">{t.editorPreviewToggle}</span>
            </button>

            {/* Save All 20 Questions Button */}
            <button
              onClick={handleSaveEntireForm}
              disabled={savingAll || loadingForm}
              className="py-2.5 px-5 rounded bg-[#00a65a] hover:bg-emerald-700 active:scale-98 text-white font-bold text-xs uppercase tracking-wider shadow flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{savingAll ? t.editorSaving : t.editorSaveAllBtn}</span>
            </button>

            {/* Test this variant as proctor button */}
            {onStartProctorPreview && (
              <button
                onClick={() => onStartProctorPreview(selectedFormId)}
                className="py-2.5 px-4 rounded bg-amber-500 hover:bg-amber-600 active:scale-98 text-white font-bold text-xs uppercase tracking-wider shadow flex items-center gap-2 transition-all"
                title={t.dashProctorPreviewDesc}
              >
                <Play className="w-4 h-4 fill-current" />
                <span className="hidden sm:inline">{t.editorTestThisVariantBtn}</span>
                <span className="sm:hidden">Test</span>
              </button>
            )}
          </div>
        </div>

        {/* Question Cards List */}
        {loadingForm ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-[#25718f] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-mono text-gray-500">Variant yuklanmoqda...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {editedQuestions.map((q, qIndex) => {
              const isMc = q.type === 'multiple_choice';
              const isSaved = Boolean(savedQuestionIds[q.id]);
              const isSavingThis = savingQuestionId === q.id;

              return (
                <div
                  key={q.id || q.number}
                  className="p-4 rounded-lg border border-gray-200 bg-gray-50/50 hover:bg-gray-50 transition-colors space-y-3"
                >
                  {/* Question Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200/60 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-[#25718f] text-white font-mono font-bold text-xs flex items-center justify-center">
                        {q.number}
                      </span>
                      <span className="text-xs font-bold text-gray-800">
                        {isMc ? `Savol №${q.number} (1-qism: Test tanlovi)` : `Savol №${q.number} (2-qism: Mustaqil yozma javob)`}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                          isMc ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                        }`}
                      >
                        {isMc ? '4 Variant' : 'Ochiq son'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {isSaved && (
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded flex items-center gap-1 font-mono animate-in fade-in">
                          <Check className="w-3.5 h-3.5" />
                          <span>{t.editorSavedSuccess}</span>
                        </span>
                      )}

                      <button
                        onClick={() => handleSaveQuestion(qIndex)}
                        disabled={isSavingThis}
                        className="py-1 px-3 rounded bg-white hover:bg-gray-100 text-[#25718f] border border-cyan-300 font-bold text-xs flex items-center gap-1 transition-all disabled:opacity-50 shadow-xs"
                      >
                        <Save className="w-3 h-3" />
                        <span>{isSavingThis ? t.editorSaving : t.editorSaveQuestionBtn}</span>
                      </button>
                    </div>
                  </div>

                  {/* Question Text Field */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-gray-600 block">
                      {t.editorQuestionTextLabel}
                    </label>
                    <textarea
                      value={q.text}
                      onChange={(e) => handleUpdateQuestion(qIndex, 'text', e.target.value)}
                      rows={2}
                      className="w-full p-2.5 rounded border border-gray-300 focus:border-[#25718f] focus:outline-none font-mono text-xs text-gray-900 bg-white"
                    />

                    {/* Math Preview */}
                    {previewMath && q.text && (
                      <div className="p-2.5 rounded bg-white border border-cyan-100 text-xs text-gray-800 shadow-2xs">
                        <span className="text-[10px] font-mono font-semibold text-[#25718f] block uppercase tracking-wider mb-1">
                          KaTeX ko'rinishi:
                        </span>
                        <MathRenderer content={q.text} />
                      </div>
                    )}
                  </div>

                  {/* Options (Multiple Choice) */}
                  {isMc && q.options && (
                    <div className="space-y-2 pt-1">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-gray-700 block">
                          {t.editorOptionsLabel}
                        </label>
                        <span className="text-[10px] text-gray-500 font-mono">
                          (Raqamlar bilan oddiy yozishingiz mumkin: 212,5 / Можно писать обычными числами: 212,5)
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {q.options.map((opt: any, optIdx: number) => {
                          const isCorrect = opt.is_correct || opt.label === q.correct_answer;
                          return (
                            <div
                              key={opt.label || optIdx}
                              onClick={() => handleSelectCorrectOption(qIndex, opt.label)}
                              className={`p-2 rounded border flex items-center gap-2 cursor-pointer transition-all ${
                                isCorrect
                                  ? 'bg-emerald-50/70 border-emerald-400 ring-1 ring-emerald-400'
                                  : 'bg-white border-gray-300 hover:border-gray-400'
                              }`}
                            >
                              <input
                                type="radio"
                                name={`q_${q.number}_correct`}
                                checked={isCorrect}
                                onChange={() => handleSelectCorrectOption(qIndex, opt.label)}
                                className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                              />

                              <span
                                className={`w-5 h-5 rounded font-mono font-black text-xs flex items-center justify-center shrink-0 ${
                                  isCorrect ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-700'
                                }`}
                              >
                                {opt.label}
                              </span>

                              <input
                                type="text"
                                value={opt.text}
                                onClick={(e) => e.stopPropagation()}
                                placeholder="Masalan: 212,5"
                                onChange={(e) => handleUpdateOptionText(qIndex, optIdx, e.target.value)}
                                className="flex-1 px-2 py-1 text-xs font-mono font-semibold text-gray-900 rounded border border-gray-200 focus:border-[#25718f] focus:outline-none bg-white"
                              />

                              {previewMath && opt.text && (
                                <div className="text-xs px-2 py-0.5 rounded bg-gray-50 border border-gray-200 shrink-0">
                                  <MathRenderer content={opt.text} />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Short Answer (Q16 - Q20) */}
                  {!isMc && (
                    <div className="space-y-1 pt-1">
                      <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-800 block">
                        {t.editorCorrectAnswerLabel}
                      </label>
                      <div className="flex items-center gap-2 max-w-xs">
                        <input
                          type="text"
                          value={q.correct_answer}
                          onChange={(e) => handleUpdateQuestion(qIndex, 'correct_answer', e.target.value)}
                          placeholder="Misol: 215 yoki 11.5"
                          className="w-full px-3 py-2 rounded border-2 border-emerald-400 focus:border-emerald-600 focus:outline-none font-mono font-bold text-sm text-emerald-900 bg-white"
                        />
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded font-mono shrink-0">
                          To'g'ri javob
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Explanation Field */}
                  <div className="space-y-1 pt-1">
                    <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-gray-500 block">
                      {t.editorExplanationLabel}
                    </label>
                    <input
                      type="text"
                      value={q.explanation || ''}
                      onChange={(e) => handleUpdateQuestion(qIndex, 'explanation', e.target.value)}
                      placeholder="Yechim tushuntirishi (LaTeX formulalar bilan)..."
                      className="w-full px-2.5 py-1.5 rounded border border-gray-300 focus:border-[#25718f] focus:outline-none font-mono text-xs text-gray-800 bg-white"
                    />

                    {previewMath && q.explanation && (
                      <div className="p-2 rounded bg-white border border-gray-200 text-xs text-gray-700">
                        <MathRenderer content={q.explanation} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom Save All Button */}
        <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-500 font-mono">
            {editedQuestions.length} ta savol tayyorlangan
          </span>
          <button
            onClick={handleSaveEntireForm}
            disabled={savingAll || loadingForm}
            className="py-3 px-8 rounded bg-[#00a65a] hover:bg-emerald-700 active:scale-98 text-white font-bold text-xs uppercase tracking-wider shadow flex items-center gap-2 transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{savingAll ? t.editorSaving : t.editorSaveAllBtn}</span>
          </button>
        </div>
      </div>

      {/* Collapsible Advanced JSON Import Box */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-5 shadow-sm space-y-3">
        <div
          onClick={() => setShowRawJson(!showRawJson)}
          className="flex items-center justify-between cursor-pointer select-none"
        >
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-[#25718f]" />
            <h2 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
              {t.importUploadTitle} (JSON)
            </h2>
          </div>
          <span className="text-xs font-mono text-[#25718f] underline font-semibold">
            {showRawJson ? 'Yashirish ▲' : 'Ochish ▼'}
          </span>
        </div>

        {showRawJson && (
          <div className="space-y-3 pt-2">
            <div className="flex justify-end">
              <button
                onClick={insertTemplate}
                className="text-xs text-[#25718f] hover:underline font-semibold flex items-center gap-1 transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{t.importTemplateBtn}</span>
              </button>
            </div>

            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              placeholder={`{\n  "form_id": ${selectedFormId},\n  "title": "${selectedFormId}-variant",\n  "questions": [...]\n}`}
              rows={6}
              className="w-full p-3 rounded border border-gray-300 font-mono text-xs text-gray-800 placeholder:text-gray-400 focus:border-[#25718f] focus:outline-none bg-white"
            />

            <div className="flex justify-end">
              <button
                onClick={handleImportJson}
                disabled={importingJson || !jsonText.trim()}
                className="py-2 px-5 rounded bg-[#25718f] hover:bg-[#1f5f79] active:scale-98 text-white font-bold text-xs shadow transition-all disabled:opacity-50"
              >
                {importingJson ? t.importSubmitting : t.importSubmitBtn}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
