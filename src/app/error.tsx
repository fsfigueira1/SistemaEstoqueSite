"use client"

import { useEffect } from "react"

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen flex h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4">
        <h1 className="text-3xl font-bold text-destructive">
          Something went wrong!
        </h1>
        <p className="text-muted-foreground">
          {error.message}
        </p>
        <button
          onClick={() => {
            reset()
          }}
          className="w-full btn btn-primary"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
