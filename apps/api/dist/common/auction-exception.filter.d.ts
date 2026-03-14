import { ExceptionFilter, ArgumentsHost, HttpException } from '@nestjs/common';
export declare class AuctionExceptionFilter implements ExceptionFilter {
    catch(exception: HttpException, host: ArgumentsHost): void;
    private inferDefaultErrorCode;
}
