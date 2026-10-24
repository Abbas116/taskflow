import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <EmptyState icon="explore_off" title="404 — Page not found" text="The page you are looking for doesn't exist or you don't have access to it."
        action={<Link to="/" className="btn btn-primary">Back to dashboard</Link>} />
    </div>
  );
}
