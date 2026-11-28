import { API_ERROR_HTTP_STATUS, type ApiErrorCode } from "@prospect-ai/contracts";

export class HttpError extends Error {
  readonly status: number;

  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
    this.status = API_ERROR_HTTP_STATUS[code];
  }
}
