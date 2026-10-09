import ExcelJS from 'exceljs';
import { GameService } from './game.service.js';

export class ExcelService {
  /**
   * Generates a beautifully styled, professional Excel (.xlsx) workbook buffer
   * containing student names, grades, scores, percentages, and testing timestamps.
   */
  public static async generateResultsWorkbook(
    dashboardData: any
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'КлассТест';
    workbook.lastModifiedBy = 'КлассТест';
    workbook.created = new Date();
    workbook.modified = new Date();

    const worksheet = workbook.addWorksheet('Результаты тестирования', {
      pageSetup: { paperSize: 9, orientation: 'landscape' },
      views: [{ showGridLines: true }],
    });

    const { game, students } = dashboardData;

    // Date formatting helpers
    const formatDate = (isoString?: string) => {
      if (!isoString) return '—';
      const d = new Date(isoString);
      return d.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    };

    const formatDateTime = (isoString?: string) => {
      if (!isoString) return '—';
      const d = new Date(isoString);
      return d.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    };

    // Calculate class averages
    let totalScore = 0;
    let totalGrade = 0;
    let gradedCount = 0;

    for (const s of students) {
      if (s.scoreReport) {
        totalScore += s.scoreReport.scorePoints;
        totalGrade += s.scoreReport.grade;
        gradedCount++;
      }
    }

    const avgScore = gradedCount > 0 ? (totalScore / gradedCount).toFixed(1) : '—';
    const avgGrade = gradedCount > 0 ? (totalGrade / gradedCount).toFixed(2) : '—';
    const testDate = formatDate(game.started_at || game.created_at);
    const testTimeStart = game.started_at ? formatDateTime(game.started_at) : '—';
    const testTimeEnd = game.finished_at ? formatDateTime(game.finished_at) : game.ends_at ? formatDateTime(game.ends_at) : '—';

    // 1. Title Banner (Rows 1 - 4)
    worksheet.mergeCells('A1:K1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'ВЕДОМОСТЬ РЕЗУЛЬТАТОВ ОНЛАЙН-ТЕСТИРОВАНИЯ';
    titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' }, // Dark slate
    };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(1).height = 36;

    // Row 2: Game info
    worksheet.mergeCells('A2:K2');
    const infoCell = worksheet.getCell('A2');
    infoCell.value = `Игра: ${game.title || 'Классный тест'}  |  Код комнаты: ${game.code}  |  Дата проведения: ${testDate}`;
    infoCell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF334155' } };
    infoCell.alignment = { vertical: 'middle', horizontal: 'center' };
    infoCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' },
    };
    worksheet.getRow(2).height = 24;

    // Row 3: Timing and class summary
    worksheet.mergeCells('A3:K3');
    const timingCell = worksheet.getCell('A3');
    timingCell.value = `Время начала: ${testTimeStart}  |  Время окончания: ${testTimeEnd}  |  Участников: ${students.length} / ${game.max_students}  |  Средний балл: ${avgScore}/20  |  Средняя оценка: ${avgGrade}`;
    timingCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF475569' } };
    timingCell.alignment = { vertical: 'middle', horizontal: 'center' };
    timingCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF8FAFC' },
    };
    worksheet.getRow(3).height = 22;

    // Blank row 4
    worksheet.getRow(4).height = 10;

    // 2. Table Column Definitions
    worksheet.columns = [
      { key: 'rank', width: 7 },
      { key: 'lastName', width: 20 },
      { key: 'firstName', width: 18 },
      { key: 'grade', width: 14 },
      { key: 'scorePoints', width: 14 },
      { key: 'percentage', width: 14 },
      { key: 'formId', width: 12 },
      { key: 'studentId', width: 10 },
      { key: 'status', width: 16 },
      { key: 'finishedAt', width: 24 },
      { key: 'suspicious', width: 24 },
    ];

    // 3. Table Header (Row 5)
    const headerRow = worksheet.getRow(5);
    headerRow.values = [
      '№ п/п',
      'Фамилия',
      'Имя',
      'Оценка',
      'Баллы (из 20)',
      'Результат (%)',
      'Бланк',
      'ID',
      'Статус',
      'Дата и время сдачи',
      'Подозрительные действия',
    ];
    headerRow.height = 28;

    headerRow.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF3B82F6' }, // Blue accent
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF1E3A8A' } },
        left: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'medium', color: { argb: 'FF1E3A8A' } },
        right: { style: 'thin', color: { argb: 'FF94A3B8' } },
      };
    });

    // Sort students by Score/Grade descending, then by Last Name
    const sorted = [...students].sort((a: any, b: any) => {
      const grA = a.scoreReport?.grade ?? 0;
      const grB = b.scoreReport?.grade ?? 0;
      if (grB !== grA) return grB - grA;

      const scA = a.scoreReport?.scorePoints ?? a.answeredCount ?? 0;
      const scB = b.scoreReport?.scorePoints ?? b.answeredCount ?? 0;
      if (scB !== scA) return scB - scA;

      return a.lastName.localeCompare(b.lastName);
    });

    // 4. Data Rows
    let currentRowNum = 6;
    sorted.forEach((st: any, idx: number) => {
      const rep = st.scoreReport;
      const grade = rep?.grade ?? '—';
      const score = rep?.scorePoints ?? st.answeredCount ?? 0;
      const pct = rep ? `${rep.percentage}%` : '—';
      const suspCount = st.securityEvents?.totalSuspicious ?? 0;
      const suspDetail =
        suspCount > 0
          ? `⚠ ${suspCount} (вкладка: ${st.securityEvents?.pageHidden || 0}, fullscreen: ${st.securityEvents?.fullscreenExit || 0})`
          : 'Нет';

      const statusText =
        st.status === 'FINISHED'
          ? 'Завершил'
          : st.isOnline
          ? 'В процессе'
          : 'Отключён';

      const row = worksheet.getRow(currentRowNum);
      row.values = [
        idx + 1,
        st.lastName,
        st.firstName,
        grade,
        score,
        pct,
        `№${st.formId}`,
        `#${String(st.studentId).padStart(2, '0')}`,
        statusText,
        formatDateTime(st.finishedAt || (st.status === 'FINISHED' ? game.finished_at : undefined)),
        suspDetail,
      ];
      row.height = 22;

      // Base borders and alignment
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.font = { name: 'Arial', size: 10 };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };

        // Alignments: Name is left aligned, numbers are centered
        if (colNumber === 2 || colNumber === 3) {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        }

        // Alternating row background for readability
        if (idx % 2 === 1) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' },
          };
        }
      });

      // Grade cell styling (Column 4)
      const gradeCell = row.getCell(4);
      if (grade === 5) {
        gradeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } }; // Light green
        gradeCell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF15803D' } };
      } else if (grade === 4) {
        gradeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } }; // Light blue
        gradeCell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF1D4ED8' } };
      } else if (grade === 3) {
        gradeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }; // Light yellow
        gradeCell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFB45309' } };
      } else if (grade === 2) {
        gradeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }; // Light red
        gradeCell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFB91C1C' } };
      }

      // Suspicious activity warning color
      if (suspCount > 0) {
        const suspCell = row.getCell(11);
        suspCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFC2410C' } };
      }

      currentRowNum++;
    });

    // 5. Bottom summary row
    const footerRow = worksheet.getRow(currentRowNum);
    worksheet.mergeCells(`A${currentRowNum}:C${currentRowNum}`);
    const fTitle = footerRow.getCell(1);
    fTitle.value = 'ИТОГО ПО КЛАССУ:';
    fTitle.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E293B' } };
    fTitle.alignment = { vertical: 'middle', horizontal: 'right' };

    footerRow.getCell(4).value = avgGrade !== '—' ? Number(avgGrade) : '—';
    footerRow.getCell(4).font = { name: 'Arial', size: 11, bold: true };
    footerRow.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };

    footerRow.getCell(5).value = avgScore !== '—' ? Number(avgScore) : '—';
    footerRow.getCell(5).font = { name: 'Arial', size: 11, bold: true };
    footerRow.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };

    footerRow.height = 24;
    footerRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF475569' } },
        bottom: { style: 'medium', color: { argb: 'FF475569' } },
      };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
