export function getDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getTodayDateString(): string {
  return getDateString(new Date());
}

export function getTomorrowDateString(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return getDateString(date);
}

export function daysBetween(earlierDate: string, laterDate: string): number {
  const a = new Date(`${earlierDate}T00:00:00`);
  const b = new Date(`${laterDate}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}
