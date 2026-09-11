import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

const numberFormatter = new Intl.NumberFormat("fa-IR");
const dateFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  day: "numeric",
  month: "long",
  year: "numeric",
});
const dateTimeFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatNumber(value: number) {
  return numberFormatter.format(value);
}

export function formatPersianDate(value: Date | string) {
  return dateFormatter.format(typeof value === "string" ? new Date(value) : value);
}

export function formatPersianDateTime(value: Date | string) {
  return dateTimeFormatter.format(typeof value === "string" ? new Date(value) : value);
}
