"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuctionExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
const errors_types_1 = require("./errors.types");
let AuctionExceptionFilter = class AuctionExceptionFilter {
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();
        const statusCode = exception.getStatus();
        const exceptionResponse = exception.getResponse();
        const isObject = typeof exceptionResponse === 'object' && exceptionResponse !== null;
        const error_code = isObject && 'error_code' in exceptionResponse
            ? exceptionResponse
                .error_code
            : this.inferDefaultErrorCode(statusCode);
        const message = isObject && 'message' in exceptionResponse
            ? String(exceptionResponse.message)
            : typeof exceptionResponse === 'string'
                ? exceptionResponse
                : JSON.stringify(exceptionResponse);
        const body = {
            statusCode,
            error_code,
            message,
            timestamp: new Date().toISOString(),
            path: request.url,
        };
        response.status(statusCode).json(body);
    }
    inferDefaultErrorCode(statusCode) {
        switch (statusCode) {
            case common_1.HttpStatus.NOT_FOUND:
                return errors_types_1.AuctionErrorCode.ITEM_NOT_FOUND;
            case common_1.HttpStatus.BAD_REQUEST:
            default:
                return errors_types_1.AuctionErrorCode.STALE_BID;
        }
    }
};
exports.AuctionExceptionFilter = AuctionExceptionFilter;
exports.AuctionExceptionFilter = AuctionExceptionFilter = __decorate([
    (0, common_1.Catch)(common_1.HttpException)
], AuctionExceptionFilter);
//# sourceMappingURL=auction-exception.filter.js.map