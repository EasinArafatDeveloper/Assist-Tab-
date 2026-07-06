import mongoose, { Schema } from 'mongoose';

const RoutineSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Please provide a title.'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    time: {
      type: String, // "HH:MM" 24h format
      trim: true,
    },
    recurrence: {
      type: [Number], // Array of day indices: 0 (Sunday) to 6 (Saturday). Empty array means every day.
      default: [],
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date, // Helps track when it was completed for daily reset checks
    },
    priority: {
      type: String,
      enum: ['emergency', 'important', 'normal'],
      default: 'normal',
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

if (process.env.NODE_ENV === 'development') {
  delete mongoose.models.Routine;
}

export default mongoose.models.Routine || mongoose.model('Routine', RoutineSchema);
