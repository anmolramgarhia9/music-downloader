import type { ChildProcess } from 'child_process';

class ActiveTasksRegistry {
  private tasks = new Map<string, ChildProcess>();

  register(id: string, proc: ChildProcess) {
    this.tasks.set(id, proc);
  }

  unregister(id: string) {
    this.tasks.delete(id);
  }

  cancel(id: string) {
    const proc = this.tasks.get(id);
    if (proc) {
      try { proc.kill(); } catch {}
      this.tasks.delete(id);
      return true;
    }
    return false;
  }
}

export const activeTasks = new ActiveTasksRegistry();