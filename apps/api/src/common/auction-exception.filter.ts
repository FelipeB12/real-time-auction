/**
 * @fileoverview Global HTTP Exception Filter for the Auction API.
 *
 * PROBLEM: NestJS's default exception handler returns a generic shape:
 *   { "statusCode": 400, "message": "...", "error": "Bad Request" }
 *
 * This is not sufficient for a production financial API. Clients need:
 *   - A machine-readable `error_code` to drive UI decisions (e.g., "STALE_BID" shows "Outbid!").
 *   - A consistent envelope shape across ALL error responses.
 *   - A timestamp for server-side log correlation.
 *
 * HOW IT WORKS:
 * NestJS exception filters intercept thrown HttpExceptions before they hit the client.
 * This filter checks whether the thrown exception carries a known `error_code` in its
 * response body. If yes, it forwards that code. If not, it applies a sensible default.
 *
 * HOW TO USE:
 * Services throw standard NestJS exceptions but attach an error_code in the response:
 *   throw new BadRequestException({ error_code: AuctionErrorCode.STALE_BID, message: '...' });
 *
 * The filter will pick up the `error_code` and include it in the standardized envelope.
 */

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuctionErrorCode, AuctionErrorResponse } from './errors.types';

/**
 * Catches all HttpExceptions thrown anywhere in the application and transforms
 * them into the standardized AuctionErrorResponse envelope.
 */
@Catch(HttpException)
export class AuctionExceptionFilter implements ExceptionFilter {
  /**
   * Intercepts the exception and writes a structured error JSON response.
   *
   * @param exception The thrown HttpException instance (BadRequestException, NotFoundException, etc.).
   * @param host The NestJS ArgumentsHost, providing access to the underlying Express request/response.
   */
  catch(exception: HttpException, host: ArgumentsHost): void {
    // Switch to the HTTP context to access Express Request and Response objects
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const statusCode = exception.getStatus();

    // The exception response can be either a string (simple message) or a structured object.
    // Services that throw enriched errors (with error_code) pass an object.
    const exceptionResponse = exception.getResponse();
    const isObject = typeof exceptionResponse === 'object' && exceptionResponse !== null;

    // Extract the error_code if the service passed one, or fall back to a generic HTTP code
    const error_code: AuctionErrorCode =
      isObject && 'error_code' in (exceptionResponse as object)
        ? (exceptionResponse as any).error_code
        : this.inferDefaultErrorCode(statusCode);

    // Extract the human-readable message from the exception
    const message: string =
      isObject && 'message' in (exceptionResponse as object)
        ? (exceptionResponse as any).message
        : String(exceptionResponse);

    // Assemble the standardized error envelope
    const body: AuctionErrorResponse = {
      statusCode,
      error_code,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(statusCode).json(body);
  }

  /**
   * Maps an HTTP status code to the most applicable default AuctionErrorCode
   * when no explicit error_code is provided by the throwing service.
   *
   * @param statusCode The integer HTTP status code from the exception.
   * @returns The best-matching AuctionErrorCode for that status.
   */
  private inferDefaultErrorCode(statusCode: number): AuctionErrorCode {
    switch (statusCode) {
      case HttpStatus.NOT_FOUND:
        return AuctionErrorCode.ITEM_NOT_FOUND;
      case HttpStatus.BAD_REQUEST:
      default:
        return AuctionErrorCode.STALE_BID;
    }
  }
}
