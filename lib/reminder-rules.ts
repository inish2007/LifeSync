export interface ReminderTask { id: string; title: string; dueDate: string; status: string; followUpDate?: string }
export interface Reminder { key: string; taskId: string; text: string; kind: 'due' | 'overdue' | 'upcoming' | 'follow-up' }
export function indiaToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function normalizeIndianPhone(value: string): string | null {
  const digits = value.replace(/[\s()+-]/g, '');
  if (/^[6-9]\d{9}$/.test(digits)) return `91${digits}`;
  return /^91[6-9]\d{9}$/.test(digits) ? digits : null;
}
export function planReminders(tasks: ReminderTask[], today = indiaToday()): Reminder[] {
  const tomorrow = new Date(`${today}T12:00:00Z`); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const nextDay = tomorrow.toISOString().slice(0, 10);
  return tasks.filter(t => t.status === 'confirmed' || t.status === 'waiting').flatMap(task => {
    if (task.status === 'waiting' && task.followUpDate && task.followUpDate <= today) return [{ key: `${task.id}:follow-up:${today}`, taskId: task.id, kind: 'follow-up' as const, text: `Time to follow up: ${task.title}. Open LifeLoop to check the response.` }];
    const kind = task.dueDate < today ? 'overdue' : task.dueDate === today ? 'due' : task.dueDate === nextDay ? 'upcoming' : null;
    return kind ? [{ key: `${task.id}:${kind}:${today}`, taskId: task.id, kind, text: `${kind === 'overdue' ? 'Overdue' : kind === 'due' ? 'Due today' : 'Due tomorrow'}: ${task.title} (${task.dueDate}). Open LifeLoop for your next step.` }] : [];
  });
}

export function botReply(command: string, tasks: ReminderTask[]): string {
  const normalized = command.trim().toUpperCase();
  if (normalized === 'STOP') return 'WhatsApp reminders paused. Reply START to resume.';
  if (normalized === 'START') return 'Reminders enabled. Send TODAY to see what needs attention, or STOP to pause.';
  if (normalized === 'TODAY') {
    const reminders = planReminders(tasks);
    return reminders.length ? reminders.slice(0, 8).map(r => `• ${r.text}`).join('\n') : 'Nothing due today or tomorrow. A little more room for life.';
  }
  return 'Hello from LifeLoop. Send TODAY for upcoming tasks, STOP to pause reminders, or START to resume. Complete tasks in LifeLoop with your receipt or confirmation.';
}
