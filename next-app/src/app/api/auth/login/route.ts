import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/User';
import { successResponse, errorResponse, handleOptions } from '@/lib/apiResponse';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_dev_only';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const { email, password } = await req.json();

    if (!email || !password) {
      return errorResponse('Email and password are required', 400);
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return errorResponse('Invalid email or password', 401);
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return errorResponse('Invalid email or password', 401);
    }

    // Create JWT
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    return successResponse({
      token,
      user: {
        id: user._id,
        email: user.email,
      },
    }, 200);
  } catch (error: any) {
    console.error('Login error:', error);
    return errorResponse(error.message || 'Internal Server Error', 500);
  }
}
