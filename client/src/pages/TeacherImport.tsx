import React, { useState, useEffect } from 'react';
import { ArrowLeft, Upload, CheckCircle2, AlertCircle, RefreshCw, FileText, Database, ShieldCheck } from 'lucide-react';
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
      setResultMessage({ success: false, message: err.message || 'Ошибка парсинга или валидации структуры JSON' });
    } finally {
      setImporting(false);
    }
  };

  const insertTemplate = () => {
    const template = {
      form_id: 1,
      title: "Экзаменационный вариант №1 (Математика 5 класс)",
      questions: [
        ...Array.from({ length: 20 }, (_, i) => ({
          number: i + 1,
          type: "multiple_choice",
          text: `Задание ${i + 1}: Вычислите значение выражения: $\\frac{${i + 1}}{5} + \\frac{2}{5}$`,
          correct_answer: "B",
          options: [
            { label: "A", text: `${i}/5`, is_correct: false },
            { label: "B", text: `${i + 3}/5`, is_correct: true },
            { label: "C", text: `${i + 1}/10`, is_correct: false },
            { label: "D", text: "1", is_correct: false }
          ]
        })),
        ...Array.from({ length: 10 }, (_, i) => ({
          number: 21 + i,
          type: "short_answer",
          text: `Задание ${21 + i}: Решите уравнение: $x + ${i * 10} = 100$`,
          correct_answer: String(100 - i * 10),
          explanation: `x = 100 - ${i * 10} = ${100 - i * 10}`
        }))
      ]
    };
    setJsonText(JSON.stringify(template, null, 2));
  };

  const completeCount = formsStatus.filter((f) => f.isComplete).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 select-none max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold tracking-wider uppercase text-cyan-400 bg-cyan-950/70 border border-cyan-800/60 px-2 py-0.5 rounded">
                ЕСЭТ • РЕПОЗИТОРИЙ КИМ
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                50 вариантов • 1500 заданий
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1">
              Реестр бланков и импорт КИМ
            </h1>
            <p className="text-xs text-slate-400">
              Верификация целостности экзаменационных вариантов и пакетная загрузка
            </p>
          </div>
        </div>

        <button
          onClick={loadStatus}
          disabled={loading}
          className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
          title="Обновить статус реестра"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Import Status Alert */}
      {resultMessage && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-start gap-2.5 ${
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

      {/* Grid of 50 Forms Status */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Статус комплектности 50 бланков (1–50)
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded border ${
              completeCount === 50
                ? 'bg-emerald-950/70 text-emerald-300 border-emerald-800'
                : 'bg-amber-950/70 text-amber-300 border-amber-800'
            }`}>
              {completeCount} из 50 укомплектованы (100%)
            </span>
          </div>
        </div>

        <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
          {formsStatus.map((f) => (
            <div
              key={f.formId}
              className={`p-2 rounded-xl border text-center transition-colors ${
                f.isComplete
                  ? 'bg-slate-950 border-emerald-500/40 text-slate-200'
                  : 'bg-slate-950 border-slate-800 text-slate-500'
              }`}
            >
              <div className="text-xs font-mono font-bold text-slate-200">
                №{String(f.formId).padStart(2, '0')}
              </div>
              <div className="text-[10px] text-emerald-400 font-mono mt-0.5 flex items-center justify-center gap-0.5">
                <ShieldCheck className="w-2.5 h-2.5" />
                <span>{f.questionCount}/30</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* JSON Import Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider">
            <Upload className="w-4 h-4 text-cyan-400" />
            <span>Пакетная загрузка / обновление бланка (JSON)</span>
          </h2>
          <button
            onClick={insertTemplate}
            className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1.5 transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Шаблон структуры</span>
          </button>
        </div>

        <textarea
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          placeholder={`{\n  "form_id": 1,\n  "title": "Экзаменационный вариант №1",\n  "questions": [\n    {\n      "number": 1,\n      "type": "multiple_choice",\n      "text": "...",\n      "options": [...],\n      "correct_answer": "B"\n    }\n  ]\n}`}
          rows={7}
          className="w-full p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-200 placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/20"
        />

        <div className="flex justify-end">
          <button
            onClick={handleImportJson}
            disabled={importing || !jsonText.trim()}
            className="py-2.5 px-6 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:scale-98 text-white font-bold text-xs shadow-lg transition-all disabled:opacity-50 border border-cyan-400"
          >
            {importing ? 'Валидация и загрузка...' : 'Загрузить и верифицировать КИМ'}
          </button>
        </div>
      </div>
    </div>
  );
};
