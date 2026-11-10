export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  return 'Something went wrong. Please try again.'
}
