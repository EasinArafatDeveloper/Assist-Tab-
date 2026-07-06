import { NextRequest } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Routine from '@/models/Routine';
import { verifyAuth } from '@/lib/verifyAuth';
import { successResponse, errorResponse, handleOptions } from '@/lib/apiResponse';

export async function OPTIONS() {
  return handleOptions();
}

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    await dbConnect();
    const authPayload = await verifyAuth(req);
    if (!authPayload) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;
    const routine = await Routine.findOne({ _id: id, userId: authPayload.userId });
    if (!routine) {
      return errorResponse('Routine not found or access denied', 404);
    }

    const body = await req.json();
    const { title, description, time, recurrence, priority, isCompleted, order } = body;

    if (title !== undefined) routine.title = title;
    if (description !== undefined) routine.description = description;
    if (time !== undefined) routine.time = time;
    if (recurrence !== undefined) routine.recurrence = recurrence;
    if (priority !== undefined) routine.priority = priority;
    if (order !== undefined) routine.order = order;

    if (isCompleted !== undefined && isCompleted !== routine.isCompleted) {
      routine.isCompleted = isCompleted;
      routine.completedAt = isCompleted ? new Date() : undefined;
    }

    await routine.save();
    return successResponse(routine, 200);
  } catch (error: any) {
    console.error('Update routine error:', error);
    return errorResponse(error.message || 'Internal Server Error', 500);
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    await dbConnect();
    const authPayload = await verifyAuth(req);
    if (!authPayload) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;
    const deletedRoutine = await Routine.findOneAndDelete({ _id: id, userId: authPayload.userId });

    if (!deletedRoutine) {
      return errorResponse('Routine not found or access denied', 404);
    }

    return successResponse({ message: 'Routine deleted successfully' }, 200);
  } catch (error: any) {
    console.error('Delete routine error:', error);
    return errorResponse(error.message || 'Internal Server Error', 500);
  }
}
