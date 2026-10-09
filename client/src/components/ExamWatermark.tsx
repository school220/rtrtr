import React, { useState, useEffect } from 'react';

interface ExamWatermarkProps {
  studentName: string;
  studentId: number;
  formId: number;
  gameCode: string;
}

export const ExamWatermark: React.FC<ExamWatermarkProps> = ({
  studentName,
  studentId,
  formId,
  gameCode,
}) => {
  const [timestamp, setTimestamp] = useState<string>(() => {
    const d = new Date();
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setTimestamp(
        d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    }, 20000);
    return () => clearInterval(timer);
  }, []);

  const watermarkText = `${studentName.toUpperCase()} • ID #${String(studentId).padStart(2, '0')} • ВАР. №${String(formId).padStart(2, '0')} • [${gameCode}] • ${timestamp}`;

  // Grid of watermarks
  const rows = Array.from({ length: 8 });
  const cols = Array.from({ length: 4 });

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none select-none z-30 overflow-hidden opacity-[0.045] dark:opacity-[0.06] flex flex-col justify-around rotate-[-15deg] scale-125"
    >
      {rows.map((_, rIdx) => (
        <div key={rIdx} className="flex justify-around whitespace-nowrap text-xs font-mono font-bold tracking-widest text-slate-400">
          {cols.map((_, cIdx) => (
            <span key={cIdx} className="mx-8">
              {watermarkText}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
};
