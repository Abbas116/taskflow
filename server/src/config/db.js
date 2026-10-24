import mongoose from 'mongoose';

// Cached connection: on Vercel every function instance may be reused for many requests,
// so we connect once and reuse the same promise. Locally it simply connects once at startup.
let connecting = null;

export default function connectDB() {
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose.connection);
  if (!connecting) {
    const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/taskflow';
    connecting = mongoose
      .connect(uri, { maxPoolSize: 5, serverSelectionTimeoutMS: 10000 })
      .then((m) => {
        console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
        return m.connection;
      })
      .catch((err) => {
        connecting = null; // allow a retry on the next request
        throw err;
      });
  }
  return connecting;
}
