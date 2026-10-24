import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null, index: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true }, // e.g. "moved this to In Progress"
  },
  { timestamps: true }
);

export default mongoose.model('Activity', activitySchema);
