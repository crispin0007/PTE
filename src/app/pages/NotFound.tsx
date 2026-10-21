import { Link } from 'react-router';

export function NotFound() {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p>
        <Link to="/practice" className="underline">
          Go to the practice menu
        </Link>
      </p>
    </div>
  );
}
