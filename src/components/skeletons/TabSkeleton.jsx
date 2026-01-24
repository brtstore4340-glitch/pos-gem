import LoadingSpinner from "../LoadingSpinner";

export default function TabSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 p-6 min-h-[60vh]">
      <LoadingSpinner label="Loading page..." size={32} />
      <div className="w-full max-w-5xl space-y-4 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3"></div>
        <div className="h-64 bg-gray-200 rounded"></div>
      </div>
    </div>
  );
}
