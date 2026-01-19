import type { CalendarEvent, ParsedEvent, ParsedTodo } from "./types";

const TIME_PATTERN_WITH_CALENDAR = /^- (\d{1,2}:\d{2}) - (\d{1,2}:\d{2}) (.+?) \[(.+?)\]$/;
const TIME_PATTERN_WITHOUT_CALENDAR = /^- (\d{1,2}:\d{2}) - (\d{1,2}:\d{2}) (.+)$/;
const DESCRIPTION_PATTERN = /^\t- (.+)$/;
const TODO_PATTERN = /^\t- \[([ x])\] (.+)$/;

export function formatTime(date: Date): string {
  return date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatEventToLine(event: CalendarEvent, includeCalendarName: boolean = true): string {
  const startTime = formatTime(event.start);
  const endTime = formatTime(event.end);
  if (includeCalendarName) {
    return `- ${startTime} - ${endTime} ${event.summary} [${event.calendarName}]`;
  }
  return `- ${startTime} - ${endTime} ${event.summary}`;
}

export function formatEventWithDescription(event: CalendarEvent, includeCalendarName: boolean = true): string[] {
  const lines: string[] = [formatEventToLine(event, includeCalendarName)];

  if (event.description) {
    const descriptionLines = event.description.split("\n").filter((line) => line.trim());
    for (const descLine of descriptionLines) {
      lines.push(`\t- ${descLine}`);
    }
  }

  return lines;
}

export function formatEventsToMarkdown(events: CalendarEvent[], includeDescription: boolean, includeCalendarName: boolean = true): string {
  const lines: string[] = [];

  for (const event of events) {
    if (includeDescription) {
      lines.push(...formatEventWithDescription(event, includeCalendarName));
    } else {
      lines.push(formatEventToLine(event, includeCalendarName));
    }
  }

  return lines.join("\n");
}

export function parseEventLine(line: string, nextLines: string[], defaultCalendarName?: string): ParsedEvent | null {
  let match = line.match(TIME_PATTERN_WITH_CALENDAR);
  let calendarName: string;
  let title: string;
  let startTime: string;
  let endTime: string;

  if (match) {
    [, startTime, endTime, title, calendarName] = match;
  } else {
    match = line.match(TIME_PATTERN_WITHOUT_CALENDAR);
    if (!match) return null;
    [, startTime, endTime, title] = match;
    calendarName = defaultCalendarName || "계획";
  }

  const description: string[] = [];

  for (const nextLine of nextLines) {
    const descMatch = nextLine.match(DESCRIPTION_PATTERN);
    if (descMatch) {
      description.push(descMatch[1]);
    } else {
      break;
    }
  }

  return {
    startTime,
    endTime,
    title,
    calendarName,
    description: description.length > 0 ? description : undefined,
    rawLine: line,
  };
}

export function parseSection(content: string, sectionHeader: string, defaultCalendarName?: string): ParsedEvent[] {
  const lines = content.split("\n");
  const events: ParsedEvent[] = [];

  let inSection = false;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("## ")) {
      inSection = line.includes(sectionHeader);
      i++;
      continue;
    }

    if (inSection && line.startsWith("- ")) {
      const remainingLines = lines.slice(i + 1);
      const descriptionLines: string[] = [];

      for (const nextLine of remainingLines) {
        if (nextLine.match(DESCRIPTION_PATTERN)) {
          descriptionLines.push(nextLine);
        } else {
          break;
        }
      }

      const event = parseEventLine(line, descriptionLines, defaultCalendarName);
      if (event) {
        events.push(event);
        i += 1 + (event.description?.length || 0);
        continue;
      }
    }

    i++;
  }

  return events;
}

export function parseDailyPlan(content: string): ParsedEvent[] {
  return parseSection(content, "Daily Plan", "계획");
}

export function parseDailyLog(content: string): ParsedEvent[] {
  return parseSection(content, "Daily Log");
}

export function updateSection(
  content: string,
  sectionHeader: string,
  newContent: string
): string {
  const lines = content.split("\n");
  const result: string[] = [];

  let inSection = false;
  let sectionFound = false;
  let contentInserted = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("## ")) {
      if (inSection && !contentInserted) {
        result.push(newContent);
        result.push("");
        contentInserted = true;
      }
      inSection = false;

      if (line.includes(sectionHeader)) {
        inSection = true;
        sectionFound = true;
        contentInserted = false;
        result.push(line);
        continue;
      }
    }

    if (inSection) {
      if (line.startsWith("- ") || line.match(DESCRIPTION_PATTERN)) {
        continue;
      }
      if (line.trim() === "") {
        continue;
      }
      if (!contentInserted) {
        result.push(newContent);
        result.push("");
        contentInserted = true;
      }
      inSection = false;
    }

    result.push(line);
  }

  if (inSection && !contentInserted) {
    result.push(newContent);
  }

  if (!sectionFound) {
    result.push("");
    result.push(`## ${sectionHeader}`);
    result.push(newContent);
  }

  return result.join("\n");
}

export function parseTimeToDate(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = timeStr.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes);
}

export function extractDateFromTitle(title: string): string | null {
  const match = title.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

export function compareEventsByTime(a: ParsedEvent, b: ParsedEvent): number {
  const aTime = a.startTime.split(":").map(Number);
  const bTime = b.startTime.split(":").map(Number);
  return aTime[0] * 60 + aTime[1] - (bTime[0] * 60 + bTime[1]);
}

export interface EventWithTodos {
  event: ParsedEvent;
  todos: ParsedTodo[];
}

export function parseDailyPlanWithTodos(content: string): EventWithTodos[] {
  const lines = content.split("\n");
  const results: EventWithTodos[] = [];

  let inSection = false;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("## ")) {
      inSection = line.includes("Daily Plan");
      i++;
      continue;
    }

    if (inSection && line.startsWith("- ")) {
      const match = line.match(TIME_PATTERN_WITHOUT_CALENDAR) || line.match(TIME_PATTERN_WITH_CALENDAR);
      if (match) {
        const [, startTime, endTime, title] = match;
        const event: ParsedEvent = {
          startTime,
          endTime,
          title: title.replace(/\s*\[.+?\]$/, ""),
          calendarName: "계획",
          rawLine: line,
        };

        const todos: ParsedTodo[] = [];
        let j = i + 1;

        while (j < lines.length) {
          const subLine = lines[j];
          const todoMatch = subLine.match(TODO_PATTERN);
          if (todoMatch) {
            todos.push({
              title: todoMatch[2],
              completed: todoMatch[1] === "x",
              parentEventTime: `${startTime} - ${endTime}`,
            });
            j++;
          } else if (subLine.match(DESCRIPTION_PATTERN)) {
            j++;
          } else {
            break;
          }
        }

        results.push({ event, todos });
        i = j;
        continue;
      }
    }

    i++;
  }

  return results;
}

export function updateTodoInContent(
  content: string,
  todoTitle: string,
  completed: boolean
): string {
  const lines = content.split("\n");
  const result: string[] = [];

  for (const line of lines) {
    const todoMatch = line.match(TODO_PATTERN);
    if (todoMatch && todoMatch[2] === todoTitle) {
      const newStatus = completed ? "x" : " ";
      result.push(`\t- [${newStatus}] ${todoTitle}`);
    } else {
      result.push(line);
    }
  }

  return result.join("\n");
}
