import { NextResponse } from 'next/server';
import { AppError, formatErrorResponse } from '@agent-web/core';

export { AppError, formatErrorResponse } from '@agent-web/core';

export function errorResponse(error: unknown) {
  if (error instanceof AppError) {
    return new NextResponse(JSON.stringify({ error: error.message, code: error.code, details: error.details }), { status: error.statusCode });
  }
  return new NextResponse(JSON.stringify({ error: 'Internal server error', code: 'INTERNAL_ERROR' }), { status: 500 });
}