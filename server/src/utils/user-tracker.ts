export interface UserEntry {
  socketId: string;
  role: 'STUDENT' | 'TEACHER' | 'VISITOR';
  name: string;
  studentId?: number;
  formId?: number;
  gameId?: string;
  gameCode?: string;
  joinedAt: Date;
  joinedTimeString: string;
  ip?: string;
}

export interface ActivityLogItem {
  id: number;
  timestamp: Date;
  timeString: string;
  action: 'JOIN' | 'RECONNECT' | 'DISCONNECT';
  role: string;
  name: string;
  studentId?: number;
  formId?: number;
  gameCode?: string;
  onlineCountAfter: number;
}

class UserTrackerService {
  private activeSockets: Map<string, UserEntry> = new Map();
  private activityLog: ActivityLogItem[] = [];
  private logCounter = 1;
  private lastPrintedOnline = -1;

  private formatTime(date: Date = new Date()): string {
    return date.toTimeString().split(' ')[0]; // "HH:MM:SS"
  }

  /**
   * Tracks a raw socket connection (visitor on site)
   */
  public onConnection(socketId: string, ip: string = '') {
    const now = new Date();
    const entry: UserEntry = {
      socketId,
      role: 'VISITOR',
      name: 'Гость (На главной / ввод пина)',
      joinedAt: now,
      joinedTimeString: this.formatTime(now),
      ip,
    };
    this.activeSockets.set(socketId, entry);

    this.logActivity({
      timestamp: now,
      timeString: this.formatTime(now),
      action: 'JOIN',
      role: 'ГОСТЬ',
      name: 'Посетитель сайта',
      onlineCountAfter: this.getTotalOnline(),
    });

    this.printQuickNotice('CONNECT', `Новый посетитель открыл сайт [IP: ${ip || 'local'}]`);
  }

  /**
   * Registers a student who entered with name and PIN
   */
  public registerStudent(data: {
    socketId: string;
    studentId: number;
    firstName: string;
    lastName: string;
    formId: number;
    gameId: string;
    gameCode?: string;
    ip?: string;
  }) {
    const now = new Date();
    const fullName = `${data.lastName} ${data.firstName}`.trim();
    const entry: UserEntry = {
      socketId: data.socketId,
      role: 'STUDENT',
      name: fullName,
      studentId: data.studentId,
      formId: data.formId,
      gameId: data.gameId,
      gameCode: data.gameCode,
      joinedAt: now,
      joinedTimeString: this.formatTime(now),
      ip: data.ip,
    };

    this.activeSockets.set(data.socketId, entry);

    this.logActivity({
      timestamp: now,
      timeString: this.formatTime(now),
      action: 'JOIN',
      role: 'УЧЕНИК',
      name: fullName,
      studentId: data.studentId,
      formId: data.formId,
      gameCode: data.gameCode,
      onlineCountAfter: this.getTotalOnline(),
    });

    this.printStudentBanner(entry);
  }

  /**
   * Registers a teacher who entered the proctor room
   */
  public registerTeacher(socketId: string, gameId: string, gameCode?: string) {
    const now = new Date();
    const entry: UserEntry = {
      socketId,
      role: 'TEACHER',
      name: 'Учитель / Проктор',
      gameId,
      gameCode,
      joinedAt: now,
      joinedTimeString: this.formatTime(now),
    };

    this.activeSockets.set(socketId, entry);

    this.logActivity({
      timestamp: now,
      timeString: this.formatTime(now),
      action: 'JOIN',
      role: 'УЧИТЕЛЬ',
      name: 'Учитель / Проктор',
      gameCode,
      onlineCountAfter: this.getTotalOnline(),
    });

    this.printQuickNotice('TEACHER', `🎓 Учитель вошёл в аудиторию [Код: ${gameCode || gameId.slice(0, 5)}]`);
  }

  /**
   * Handles user disconnection
   */
  public onDisconnect(socketId: string) {
    const entry = this.activeSockets.get(socketId);
    this.activeSockets.delete(socketId);

    const now = new Date();
    const timeStr = this.formatTime(now);

    if (entry) {
      this.logActivity({
        timestamp: now,
        timeString: timeStr,
        action: 'DISCONNECT',
        role: entry.role,
        name: entry.name,
        studentId: entry.studentId,
        formId: entry.formId,
        gameCode: entry.gameCode,
        onlineCountAfter: this.getTotalOnline(),
      });

      if (entry.role === 'STUDENT') {
        console.log(
          `[${timeStr}] 🔴 ВЫХОД: Ученик ${entry.name} (ID #${entry.studentId}) покинул сайт | 👥 Сейчас онлайн: ${this.getTotalOnline()}`
        );
      } else if (entry.role === 'TEACHER') {
        console.log(
          `[${timeStr}] 🎓 ВЫХОД: Учитель покинул панель управления | 👥 Сейчас онлайн: ${this.getTotalOnline()}`
        );
      } else {
        console.log(
          `[${timeStr}] ⚪ Посетитель закрыл вкладку | 👥 Сейчас онлайн: ${this.getTotalOnline()}`
        );
      }
    }
  }

  private logActivity(item: Omit<ActivityLogItem, 'id'>) {
    this.activityLog.push({
      id: this.logCounter++,
      ...item,
    });
    // Keep last 150 events in memory
    if (this.activityLog.length > 150) {
      this.activityLog.shift();
    }
  }

  public getTotalOnline(): number {
    return this.activeSockets.size;
  }

  public getOnlineCounts() {
    let students = 0;
    let teachers = 0;
    let visitors = 0;

    for (const u of this.activeSockets.values()) {
      if (u.role === 'STUDENT') students++;
      else if (u.role === 'TEACHER') teachers++;
      else visitors++;
    }

    return {
      total: this.activeSockets.size,
      students,
      teachers,
      visitors,
    };
  }

  public getActiveUsersList(): UserEntry[] {
    return Array.from(this.activeSockets.values()).sort(
      (a, b) => a.joinedAt.getTime() - b.joinedAt.getTime()
    );
  }

  public getActivityLog(): ActivityLogItem[] {
    return [...this.activityLog].reverse();
  }

  private printQuickNotice(type: string, message: string) {
    const counts = this.getOnlineCounts();
    console.log(
      `[${this.formatTime()}] 📡 ${message} | 👥 Всего онлайн: ${counts.total} (Учеников: ${counts.students}, Учителей: ${counts.teachers})`
    );
  }

  private printStudentBanner(entry: UserEntry) {
    const counts = this.getOnlineCounts();
    console.log(`\n┌────────────────────────────────────────────────────────────────────────┐`);
    console.log(`│ 🟢 [${entry.joinedTimeString}] НОВЫЙ ВХОД УЧЕНИКА В СИСТЕМУ                              │`);
    console.log(`│ 👤 ФИО:        ${(entry.name).padEnd(55)} │`);
    console.log(`│ 📌 ID ученика: #${String(entry.studentId || 0).padEnd(4)} | Вариант КИМ: №${String(entry.formId || 0).padEnd(3)} | Код: ${String(entry.gameCode || '').padEnd(16)} │`);
    console.log(`│ 👥 СЕЙЧАС ОНЛАЙН НА САЙТЕ: ${String(counts.total).padEnd(3)} (Учеников: ${String(counts.students).padEnd(2)}, Учителей: ${String(counts.teachers).padEnd(2)})         │`);
    console.log(`└────────────────────────────────────────────────────────────────────────┘\n`);
  }

  /**
   * Prints a comprehensive table of all currently online users
   */
  public printRosterTable() {
    const users = this.getActiveUsersList();
    const counts = this.getOnlineCounts();
    const timeStr = this.formatTime();

    console.log(`\n========================================================================================`);
    console.log(`👥 СВОДКА СЕРВЕРА [${timeStr}]: СЕЙЧАС НА САЙТЕ ОНЛАЙН: ${counts.total} (Учеников: ${counts.students}, Учителей: ${counts.teachers})`);
    console.log(`----------------------------------------------------------------------------------------`);

    if (users.length === 0) {
      console.log(`   (На сайте сейчас нет активных пользователей)`);
    } else {
      console.log(
        `   №  | Время входа | Роль     | ФИО / Описание                   | ID     | Вариант | Аудитория`
      );
      console.log(
        `  ----+-------------+----------+----------------------------------+--------+---------+----------`
      );

      users.forEach((u, i) => {
        const num = String(i + 1).padStart(3, ' ');
        const time = u.joinedTimeString.padEnd(11, ' ');
        const role = (u.role === 'STUDENT' ? 'Ученик' : u.role === 'TEACHER' ? 'Учитель' : 'Гость').padEnd(8, ' ');
        const name = u.name.slice(0, 32).padEnd(32, ' ');
        const sid = u.studentId ? `#${String(u.studentId).padStart(2, '0')}`.padEnd(6, ' ') : '—     ';
        const form = u.formId ? `№${String(u.formId).padStart(2, '0')}`.padEnd(7, ' ') : '—      ';
        const code = (u.gameCode || '—').padEnd(9, ' ');

        console.log(`  ${num} | ${time} | ${role} | ${name} | ${sid} | ${form} | ${code}`);
      });
    }

    console.log(`========================================================================================\n`);
  }
}

export const userTracker = new UserTrackerService();
