import React, { useState, useEffect } from 'react';
import { ArrowLeft, Upload, CheckCircle2, AlertCircle, RefreshCw, FileText } from 'lucide-react';
import { api } from '../services/api.js';

interface TeacherImportProps {
  onBack: () => void;
}

export const TeacherImport: React.FC<TeacherImportProps> = ({ onBack }) => {
  const [formsStatus, setFormsStatus] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [importing, setImporting] = useState(false);
  const [resultMessage, setResultMessage] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const res = await api.getFormsStatus();
      setFormsStatus(res.forms || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleImportJson = async () => {
    setResultMessage(null);
    setImporting(true);

    try {
      const parsed = JSON.parse(jsonText);
      const res = await api.importForm(parsed);
      setResultMessage({ success: true, message: res.message });
      setJsonText('');
      await loadStatus();
    } catch (err: any) {
      setResultMessage({ success: false, message: err.message || 'Ошибка парсинга или валидации JSON' });
    } finally {
      setImporting(false);
    }
  };

  const insertTemplate = () => {
    const template = {
      form_id: 1,
      title: "Бланк №1 (Обновлённый)",
      questions: [
        ...Array.from({ length: 20 }, (_, i) => ({
          number: i + 1,
          type: "multiple_choice",
          text: `Вопрос ${i + 1}: Сколько будет $\\frac{${i + 1}}{4} + \\frac{1}{4}$?`,
          correct_answer: "B",
          options: [
            { label: "A", text: "1/4", is_correct: false },
            { label: "B", text: "Правильный", is_correct: true },
            { label: "C", text: "3/4", is_correct: false },
            { label: "D", text: "4/4", is_correct: false }
          ]
        })),
        ...Array.from({ length: 10 }, (_, i) => ({
          number: 21 + i,
          type: "short_answer",
          text: `Вопрос ${21 + i}: Решите уравнение: $x + ${i} = 10$`,
          correct_answer: String(10 - i),
          explanation: `x = 10 - ${i} = ${10 - i}`
        }))
      ]
    };
    setJsonText(JSON.stringify(template, null, 2));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 select-none max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white">Управление бланками и импорт</h1>
            <p className="text-xs text-slate-400">Проверка 50 уникальных бланков и загрузка вопросов</p>
          </div>
        </div>

        <button
          onClick={loadStatus}
          disabled={loading}
          className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors"
          title="Обновить статус"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Import Status Alert */}
      {resultMessage && (
        <div
          className={`p-4 rounded-2xl border text-sm flex items-start gap-2.5 ${
            resultMessage.success
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {resultMessage.success ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          )}
          <span className="font-medium">{resultMessage.message}</span>
        </div>
      )}

      {/* JSON Import Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Upload className="w-4 h-4 text-indigo-400" />
            <span>Импорт бланка в формате JSON</span>
          </h2>
          <button
            onClick={insertTemplate}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Вставить пример JSON</span>
          </button>
        </div>

        <textarea
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          placeholder={`{\n  "form_id": 1,\n  "questions": [\n    {\n      "number": 1,\n      "type": "multiple_choice",\n      "text": "...",\n      "options": [...],\n      "correct_answer": "..."\n    }\n  ]\n}`}
          rows={8}
          className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-700 font-mono text-xs text-slate-200 placeholder:text-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20"
        />

        <div className="flex justify-end">
          <button
            onClick={handleImportJson}
            disabled={importing || !jsonText.trim()}
            className="py-3 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-white font-bold text-xs shadow-lg transition-all disabled:opacity-50"
          >
            {importing ? 'Импортирование...' : 'Загрузить и проверить бланк'}
          </button>
        </div>
      </div>

      {/* Grid of 50 Forms Status */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white">Статус всех 50 бланков в системе</h2>
          <span className="text-xs text-slate-400">
            {formsStatus.filter((f) => f.isComplete).length} из 50 укомплектованы
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 md:grid-cols-10 gap-2">
          {formsStatus.map((f) => (
            <div
              key={f.formId}
              className={`p-2.5 rounded-xl border text-center transition-colors ${
                f.isComplete
                  ? 'bg-slate-800/80 border-emerald-500/40 text-slate-200'
                  : 'bg-slate-800/30 border-slate-700/60 text-slate-500'
              }`}
            >
              <div className="text-xs font-mono font-bold">№{String(f.formId).padStart(2, '0')}</div>
              <div className="text-[10px] text-slate-400 font-mono">
                {f.questionCount}/30
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
