export class UnsupportedMessageTypeError extends Error {
  constructor(messageType: string) {
    super(`Unsupported message type: ${messageType}`)
    this.name = "UnsupportedMessageTypeError"
  }
}

export class UnsupportedMessageTypeWithoutResponseError extends Error {
  constructor(messageType: string) {
    super(`Unsupported message type: ${messageType}`)
    this.name = "UnsupportedMessageTypeWithoutResponseError"
  }
}
