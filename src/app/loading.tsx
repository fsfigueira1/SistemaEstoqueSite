export default function Loading() {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="flex space-x-2">
        <div className="h-4 w-4 rounded-full animate-pulse bg-primary"></div>
        <div className="h-4 w-4 rounded-full animate-pulse bg-primary"></div>
        <div className="h-4 w-4 rounded-full animate-pulse bg-primary"></div>
      </div>
    </div>
  )
}
