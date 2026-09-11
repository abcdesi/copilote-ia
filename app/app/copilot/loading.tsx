import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto flex h-[calc(100vh-56px)] max-w-3xl flex-col justify-end gap-4 px-4 py-6 sm:px-6">
      <Skeleton className="ml-auto h-10 w-48 rounded-2xl" />
      <Skeleton className="h-16 w-2/3 rounded-2xl" />
      <Skeleton className="h-10 w-full rounded-full" />
    </div>
  );
}
