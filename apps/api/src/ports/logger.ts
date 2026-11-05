/** The subset of the (pino) logger that inner layers may use. Never pass PII to it. */
export interface Logger {
  info(obj: object, msg: string): void;
  warn(obj: object, msg: string): void;
  error(obj: object, msg: string): void;
}
