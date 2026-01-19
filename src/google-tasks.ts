import { google, tasks_v1 } from "googleapis";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import type {
  GoogleCalendarSyncSettings,
  ServiceAccountKey,
  TaskItem,
} from "./types";

export class GoogleTasksService {
  private settings: GoogleCalendarSyncSettings;
  private tasks: tasks_v1.Tasks | null = null;
  private taskListId: string | null = null;

  constructor(settings: GoogleCalendarSyncSettings) {
    this.settings = settings;
  }

  private async getServiceAccountKey(): Promise<ServiceAccountKey> {
    const client = new SecretsManagerClient({
      region: this.settings.awsRegion,
      credentials: {
        accessKeyId: this.settings.awsAccessKeyId,
        secretAccessKey: this.settings.awsSecretAccessKey,
      },
    });

    const response = await client.send(
      new GetSecretValueCommand({
        SecretId: this.settings.awsSecretName,
      })
    );

    if (!response.SecretString) {
      throw new Error("Failed to retrieve service account key from AWS");
    }

    return JSON.parse(response.SecretString) as ServiceAccountKey;
  }

  async initialize(): Promise<void> {
    const serviceAccountKey = await this.getServiceAccountKey();

    const auth = new google.auth.JWT({
      email: serviceAccountKey.client_email,
      key: serviceAccountKey.private_key,
      scopes: ["https://www.googleapis.com/auth/tasks"],
      subject: this.settings.impersonateEmail,
    });

    this.tasks = google.tasks({ version: "v1", auth });
    await this.findOrCreateTaskList();
  }

  private async findOrCreateTaskList(): Promise<void> {
    if (!this.tasks) {
      await this.initialize();
    }

    const response = await this.tasks!.tasklists.list();
    const lists = response.data.items || [];

    const myTasks = lists.find((list) => list.title === "My Tasks" || list.title === "내 할 일");
    
    if (myTasks && myTasks.id) {
      this.taskListId = myTasks.id;
    } else if (lists.length > 0 && lists[0].id) {
      this.taskListId = lists[0].id;
    } else {
      const newList = await this.tasks!.tasklists.insert({
        requestBody: { title: "My Tasks" },
      });
      this.taskListId = newList.data.id || null;
    }
  }

  async getTasksForDate(date: Date): Promise<TaskItem[]> {
    if (!this.tasks || !this.taskListId) {
      await this.initialize();
    }

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const response = await this.tasks!.tasks.list({
      tasklist: this.taskListId!,
      showCompleted: true,
      showHidden: true,
    });

    const allTasks = response.data.items || [];

    return allTasks
      .filter((task) => {
        if (!task.due) return false;
        const dueDate = new Date(task.due);
        return dueDate >= startOfDay && dueDate <= endOfDay;
      })
      .map((task) => ({
        id: task.id || "",
        title: task.title || "",
        completed: task.status === "completed",
        due: task.due ? new Date(task.due) : undefined,
        notes: task.notes || undefined,
      }));
  }

  async createTask(
    title: string,
    due: Date,
    startTime?: string,
    notes?: string
  ): Promise<string> {
    if (!this.tasks || !this.taskListId) {
      await this.initialize();
    }

    const taskNotes = startTime 
      ? (notes ? `[${startTime}]\n${notes}` : `[${startTime}]`)
      : notes;

    const response = await this.tasks!.tasks.insert({
      tasklist: this.taskListId!,
      requestBody: {
        title,
        due: due.toISOString(),
        notes: taskNotes,
      },
    });

    return response.data.id || "";
  }

  async updateTask(
    taskId: string,
    title: string,
    completed: boolean,
    due?: Date,
    startTime?: string,
    notes?: string
  ): Promise<void> {
    if (!this.tasks || !this.taskListId) {
      await this.initialize();
    }

    const taskNotes = startTime 
      ? (notes ? `[${startTime}]\n${notes}` : `[${startTime}]`)
      : notes;

    await this.tasks!.tasks.update({
      tasklist: this.taskListId!,
      task: taskId,
      requestBody: {
        title,
        status: completed ? "completed" : "needsAction",
        due: due?.toISOString(),
        notes: taskNotes,
      },
    });
  }

  async deleteTask(taskId: string): Promise<void> {
    if (!this.tasks || !this.taskListId) {
      await this.initialize();
    }

    await this.tasks!.tasks.delete({
      tasklist: this.taskListId!,
      task: taskId,
    });
  }

  async findTaskByTitle(title: string, date: Date): Promise<TaskItem | null> {
    const tasks = await this.getTasksForDate(date);
    return tasks.find((t) => t.title === title) || null;
  }

  clearCache(): void {
    this.tasks = null;
    this.taskListId = null;
  }
}
