export class AbortError extends Error {
  public constructor (
    message: string,
    public taskId: `${string}-${string}-${string}-${string}-${string}`
  ) {
    super(message)
    this.name = 'AbortError'
  }
}
