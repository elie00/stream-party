import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-purple-600 mb-4">404</h1>
        <h2 className="text-2xl font-semibold mb-2">Room Not Found</h2>
        <p className="text-[#a0a0a0] mb-6">
          The room you're looking for doesn't exist or has been closed.
        </p>
        <Link
          to="/"
          className="inline-block bg-[#7c3aed] hover:bg-[#6d28d9] text-white px-6 py-3 rounded-lg transition-colors font-medium"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
