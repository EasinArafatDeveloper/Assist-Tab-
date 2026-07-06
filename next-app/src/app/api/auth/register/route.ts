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

    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return errorResponse('Email is already registered', 400);
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const newUser = await User.create({
      email: email.toLowerCase(),
      password: hashedPassword,
    });

    // Create JWT
    const token = jwt.sign(
      { userId: newUser._id, email: newUser.email },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    return successResponse({
      token,
      user: {
        id: newUser._id,
        email: newUser.email,
      },
    }, 201);
  } catch (error: any) {
    console.error('Registration error:', error);
    return errorResponse(error.message || 'Internal Server Error', 500);
  }
}
