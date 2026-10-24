import mongoose from 'mongoose';

const columnSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 40 },
  color: { type: String, default: '#6366F1' },
  isDone: { type: Boolean, default: false }, // tasks in this column count as completed
});

const memberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['admin', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, default: '', maxlength: 500 },
    color: { type: String, default: '#6366F1' },
    icon: { type: String, default: 'web' }, // Material Symbols icon name
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [memberSchema],
    columns: {
      type: [columnSchema],
      default: () => [
        { name: 'To Do', color: '#3B82F6' },
        { name: 'In Progress', color: '#F59E0B' },
        { name: 'In Review', color: '#8B5CF6' },
        { name: 'Done', color: '#10B981', isDone: true },
      ],
    },
  },
  { timestamps: true }
);

projectSchema.index({ 'members.user': 1 });

export default mongoose.model('Project', projectSchema);
