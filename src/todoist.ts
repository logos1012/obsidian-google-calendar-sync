import { requestUrl } from "obsidian";
import type { TodoistTask } from "./types";

const TODOIST_API_BASE = "https://api.todoist.com/rest/v2";

export class TodoistService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request(
    method: string,
    endpoint: string,
    body?: Record<string, unknown>
  ): Promise<unknown> {
    const response = await requestUrl({
      url: `${TODOIST_API_BASE}${endpoint}`,
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (response.status >= 400) {
      throw new Error(`Todoist API error: ${response.status}`);
    }

    return response.json;
  }

  async getTasksForDate(date: Date): Promise<TodoistTask[]> {
    const dateStr = this.formatDate(date);
    const filter = `due: ${dateStr}`;

    const tasks = (await this.request("GET", `/tasks?filter=${encodeURIComponent(filter)}`)) as Array<{
      id: string;
      content: string;
      is_completed: boolean;
      due?: { date: string; datetime?: string };
      duration?: { amount: number; unit: string };
    }>;

    const completedTasks = await this.getCompletedTasksForDate(date);

    const activeTasks: TodoistTask[] = tasks.map((t) => ({
      id: t.id,
      content: t.content,
      isCompleted: t.is_completed,
      due: t.due,
      duration: t.duration,
    }));

    return [...activeTasks, ...completedTasks];
  }

  private async getCompletedTasksForDate(date: Date): Promise<TodoistTask[]> {
    const dateStr = this.formatDate(date);
    const since = `${dateStr}T00:00:00`;
    const until = `${dateStr}T23:59:59`;

    try {
      const response = await requestUrl({
        url: `https://api.todoist.com/sync/v9/completed/get_all?since=${since}&until=${until}`,
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      const data = response.json as { items: Array<{ task_id: string; content: string; due?: { date: string } }> };
      return (data.items || []).map((t) => ({
        id: t.task_id,
        content: t.content,
        isCompleted: true,
        due: t.due,
      }));
    } catch {
      return [];
    }
  }

  async createTask(
    content: string,
    dateStr: string,
    startTime: string,
    endTime: string
  ): Promise<string> {
    const datetime = `${dateStr}T${startTime}:00`;
    const durationMinutes = this.calculateDuration(startTime, endTime);

    const body: Record<string, unknown> = {
      content,
      due_datetime: datetime,
    };

    if (durationMinutes > 0) {
      body.duration = durationMinutes;
      body.duration_unit = "minute";
    }

    const result = (await this.request("POST", "/tasks", body)) as { id: string };
    return result.id;
  }

  async closeTask(taskId: string): Promise<void> {
    try {
      await this.request("POST", `/tasks/${taskId}/close`);
    } catch (e) {
      if (!(e instanceof Error && e.message.includes("404"))) {
        throw e;
      }
    }
  }

  async reopenTask(taskId: string): Promise<void> {
    try {
      await this.request("POST", `/tasks/${taskId}/reopen`);
    } catch (e) {
      if (!(e instanceof Error && e.message.includes("404"))) {
        throw e;
      }
    }
  }

  async updateTask(
    taskId: string,
    content: string,
    dateStr: string,
    startTime: string,
    endTime: string
  ): Promise<void> {
    const datetime = `${dateStr}T${startTime}:00`;
    const durationMinutes = this.calculateDuration(startTime, endTime);

    const body: Record<string, unknown> = {
      content,
      due_datetime: datetime,
    };

    if (durationMinutes > 0) {
      body.duration = durationMinutes;
      body.duration_unit = "minute";
    }

    await this.request("POST", `/tasks/${taskId}`, body);
  }

  async deleteTask(taskId: string): Promise<void> {
    await this.request("DELETE", `/tasks/${taskId}`);
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private calculateDuration(startTime: string, endTime: string): number {
    const [startHour, startMin] = startTime.split(":").map(Number);
    const [endHour, endMin] = endTime.split(":").map(Number);
    return (endHour * 60 + endMin) - (startHour * 60 + startMin);
  }
}
