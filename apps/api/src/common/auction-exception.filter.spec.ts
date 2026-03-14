/**
 * @fileoverview Unit tests for the AuctionExceptionFilter.
 *
 * Validates three scenarios:
 *   1. A NotFoundException with a structured error_code is correctly transformed.
 *   2. A BadRequestException with a structured error_code is correctly transformed.
 *   3. A plain exception with no error_code gets an inferred default code.
 *
 * Uses a minimal mock of the NestJS ArgumentsHost to avoid running a full HTTP server.
 */

import { ArgumentsHost, BadRequestException, NotFoundException } from '@nestjs/common';
import { AuctionExceptionFilter } from './auction-exception.filter';
import { AuctionErrorCode } from './errors.types';

describe('AuctionExceptionFilter', () => {
  let filter: AuctionExceptionFilter;

  /** Minimal mock of Express Response and Request objects. */
  const mockResponse = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const mockRequest = { url: '/bids/place-bid' };

  /**
   * Builds a minimal NestJS ArgumentsHost mock pointing at our fake Express objects.
   * ArgumentsHost is the interface the filter uses to access HTTP context.
   */
  const buildMockHost = (): ArgumentsHost =>
    ({
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as unknown as ArgumentsHost);

  beforeEach(() => {
    filter = new AuctionExceptionFilter();
    jest.clearAllMocks();
  });

  /**
   * When a NotFoundException is thrown with a structured body (error_code + message),
   * the filter must forward the error_code and return HTTP 404.
   */
  it('should return a structured 404 with ITEM_NOT_FOUND error_code', () => {
    const exception = new NotFoundException({
      error_code: AuctionErrorCode.ITEM_NOT_FOUND,
      message: 'Auction item not found.',
    });

    filter.catch(exception, buildMockHost());

    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        error_code: AuctionErrorCode.ITEM_NOT_FOUND,
        message: 'Auction item not found.',
      }),
    );
  });

  /**
   * When a BadRequestException is thrown with STALE_BID, the filter
   * must include it in the response body.
   */
  it('should return a structured 400 with STALE_BID error_code', () => {
    const exception = new BadRequestException({
      error_code: AuctionErrorCode.STALE_BID,
      message: 'Bid of $120 was rejected.',
    });

    filter.catch(exception, buildMockHost());

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        error_code: AuctionErrorCode.STALE_BID,
        message: 'Bid of $120 was rejected.',
      }),
    );
  });

  /**
   * When a plain exception (no error_code) is thrown, the filter infers a
   * sensible default code from the HTTP status. A plain 400 defaults to STALE_BID.
   */
  it('should infer a default error_code when none is provided', () => {
    const exception = new BadRequestException('Something went wrong');

    filter.catch(exception, buildMockHost());

    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        error_code: AuctionErrorCode.STALE_BID, // Inferred default for 400
      }),
    );
  });
});
