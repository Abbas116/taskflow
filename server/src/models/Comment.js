import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema(
  {
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true, maxlength: 5000 },
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null }, // one level of replies
    edited: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model('Comment', commentSchema);
