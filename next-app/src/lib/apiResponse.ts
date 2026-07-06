import { NextResponse } from 'next/server';

export function corsResponse(response: NextResponse): NextResponse {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return response;
}

export function handleOptions(): NextResponse {
  const response = new NextResponse(null, { status: 204 });
  return corsResponse(response);
}

export function successResponse(data: any, status = 200): NextResponse {
  const response = NextResponse.json({ success: true, data }, { status });
  return corsResponse(response);
}

export function errorResponse(message: string, status = 400): NextResponse {
  const response = NextResponse.json({ success: false, error: message }, { status });
  return corsResponse(response);
}
