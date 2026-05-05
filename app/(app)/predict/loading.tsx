export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#1a5c38] border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-[#aaa]">Laden...</span>
      </div>
    </div>
  )
}