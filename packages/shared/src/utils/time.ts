const DEFAULT_TIMEZONE = 'Europe/Istanbul';

export const getNow = (): Date => new Date();

export const toISOString = (date: Date): string => date.toISOString();

export const getTimezone = (): string => DEFAULT_TIMEZONE;
