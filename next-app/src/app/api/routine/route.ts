import { NextRequest } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Routine from '@/models/Routine';
import { verifyAuth } from '@/lib/verifyAuth';
import { successResponse, errorResponse, handleOptions } from '@/lib/apiResponse';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const authPayload = await verifyAuth(req);
    if (!authPayload) {
      return errorResponse('Unauthorized', 401);
    }

    // Timezone offset in minutes (e.g. 240 for UTC-4) passed from client
    const searchParams = new URL(req.url).searchParams;
    const clientOffset = Number(searchParams.get('offset') || '0');

    // Get all routines
    const routines = await Routine.find({ userId: authPayload.userId }).sort({ order: 1, createdAt: 1 });

    // Daily reset check:
    // If a routine is marked completed but the completion date is on a different calendar day
    // (based on the client's timezone), reset it.
    const now = new Date();
    // Convert current time to client local time
    const clientNow = new Date(now.getTime() - clientOffset * 60 * 1000);
    const clientTodayStr = clientNow.toISOString().split('T')[0]; // "YYYY-MM-DD"

    let hasUpdates = false;

    for (const routine of routines) {
      if (routine.isCompleted && routine.completedAt) {
        const compTime = new Date(routine.completedAt);
        const clientCompTime = new Date(compTime.getTime() - clientOffset * 60 * 1000);
        const clientCompDayStr = clientCompTime.toISOString().split('T')[0];

        if (clientCompDayStr !== clientTodayStr) {
          routine.isCompleted = false;
          routine.completedAt = undefined;
          await routine.save();
          hasUpdates = true;
        }
      }
    }

    // Refetch if updates happened to return correct statuses
    const finalRoutines = hasUpdates 
      ? await Routine.find({ userId: authPayload.userId }).sort({ order: 1, createdAt: 1 })
      : routines;

    return successResponse(finalRoutines, 200);
  } catch (error: any) {
    console.error('Fetch routines error:', error);
    return errorResponse(error.message || 'Internal Server Error', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const authPayload = await verifyAuth(req);
    if (!authPayload) {
      return errorResponse('Unauthorized', 401);
    }

    const { title, description, time, recurrence, priority, order } = await req.json();

    if (!title) {
      return errorResponse('Title is required', 400);
    }

    const newRoutine = await Routine.create({
      userId: authPayload.userId,
      title,
      description,
      time,
      recurrence: recurrence || [],
      priority: priority || 'normal',
      order: order || 0,
      isCompleted: false,
    });

    return successResponse(newRoutine, 201);
  } catch (error: any) {
    console.error('Create routine error:', error);
    return errorResponse(error.message || 'Internal Server Error', 500);
  }
}
