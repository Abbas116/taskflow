import mongoose from 'mongoose';

const subtaskSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  done: { type: Boolean, default: false },
});

const taskSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 10000 },
    column: { type: mongoose.Schema.Types.ObjectId, required: true }, // _id of a Project.columns subdocument
    order: { type: Number, default: 0 }, // position inside the column
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
    labels: [{ type: String, trim: true, maxlength: 30 }],
    dueDate: { type: Date, default: null },
    dueNotified: { type: Boolean, default: false },
    assignees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    subtasks: [subtaskSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isDone: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    commentsCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

taskSchema.index({ project: 1, column: 1, order: 1 });
taskSchema.index({ assignees: 1, isDone: 1 });

export default mongoose.model('Task', taskSchema);
