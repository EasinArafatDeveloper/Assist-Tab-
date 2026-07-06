import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_dev_only';

export interface AuthPayload {
  userId: string;
  email: string;
}

export async function verifyAuth(req: NextRequest): Promise<AuthPayload | null> {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return null;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    if (!decoded || !decoded.userId) {
      return null;
    }

    return decoded;
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
}
