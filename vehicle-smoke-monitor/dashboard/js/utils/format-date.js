import { CONFIG } from '../config.js';

const fmt = (opts) => new Intl.DateTimeFormat('en-GB', { timeZone: CONFIG.TIMEZONE, ...opts });

export const formatNPTDateTime = (d = new Date()) =>
  fmt({ day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    second: '2-digit', hour12: true }).format(new Date(d)) + ' NPT';

export const formatNPTDate = (d) =>
  fmt({ day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(d));

export const formatNPTTime = (d) =>
  fmt({ hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(d));