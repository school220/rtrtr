import { userTracker } from '../src/utils/user-tracker.js';

console.log('🧪 Testing UserTrackerService Console Output...\n');

// 1. Visitor connects
console.log('--- Step 1: Visitor connects ---');
userTracker.onConnection('socket_guest_1', '192.168.1.45');
userTracker.onConnection('socket_guest_2', '192.168.1.88');

// 2. Student registers
console.log('\n--- Step 2: Student registers ---');
userTracker.registerStudent({
  socketId: 'socket_guest_1',
  studentId: 7,
  firstName: 'Алексей',
  lastName: 'Смирнов',
  formId: 3,
  gameId: 'game_xyz_123',
  gameCode: 'MATH-2026',
  ip: '192.168.1.45',
});

// 3. Another student registers
userTracker.registerStudent({
  socketId: 'socket_st_2',
  studentId: 12,
  firstName: 'Екатерина',
  lastName: 'Иванова',
  formId: 1,
  gameId: 'game_xyz_123',
  gameCode: 'MATH-2026',
  ip: '192.168.1.99',
});

// 4. Teacher registers
console.log('\n--- Step 3: Teacher joins ---');
userTracker.registerTeacher('socket_teacher_1', 'game_xyz_123', 'MATH-2026');

// 5. Print live roster table
console.log('\n--- Step 4: Printing Live Server Roster Table ---');
userTracker.printRosterTable();

// 6. Student and Visitor disconnect
console.log('--- Step 5: Disconnections ---');
userTracker.onDisconnect('socket_guest_2');
userTracker.onDisconnect('socket_guest_1');

console.log('\n--- Step 6: Printing Updated Roster ---');
userTracker.printRosterTable();

console.log('✅ UserTrackerService test passed!');
