import { WAMessage } from "@whiskeysockets/baileys"
import { MessageTypeEnum } from "./message-type.enum"
import { UnsupportedMessageTypeError } from "./custom-errors"

export class ContactDTO {
  id: string
  name: string
  number: string
  isGroup: boolean
  isMe: boolean

  constructor(wMessage: WAMessage) {
    const id = wMessage.key?.remoteJid

    if (!id) {
      throw new UnsupportedMessageTypeError("Remote JID not found")
    }

    this.id = id
    this.name = wMessage.pushName || wMessage.verifiedBizName || ""
    this.number = id.split("@")[0]
    this.isGroup = id.endsWith("@g.us")
    this.isMe = wMessage.key?.fromMe || false
  }
}

export interface IMessage {
  type: MessageTypeEnum
  content: string
  target: WAMessage
  contact: ContactDTO
  timestamp: number | Long.Long
}

export interface IMediaMessage extends IMessage {
  fileName: string
  filePath: string
  mimeType: string
}

export interface ILocationMessage {
  type: MessageTypeEnum
  target: WAMessage
  contact: ContactDTO
  timestamp: number | Long.Long
  degreesLatitude: number
  degreesLongitude: number
}

export abstract class MessageDTO implements IMessage {
  target: WAMessage
  type: MessageTypeEnum
  contact: ContactDTO
  timestamp: number

  constructor(wMessage: WAMessage, type: MessageTypeEnum) {
    this.target = wMessage
    this.type = type
    this.contact = new ContactDTO(wMessage)
    this.timestamp = wMessage.messageTimestamp as number
  }

  abstract get content(): string
  abstract serialize(): object
}

export class TextMessage extends MessageDTO {
  get content(): string {
    if (this.type === MessageTypeEnum.ExtendedText) {
      return this.target?.message?.[MessageTypeEnum.ExtendedText]?.text || ""
    } else if (this.type === MessageTypeEnum.Conversation) {
      return this.target?.message?.[MessageTypeEnum.Conversation] || ""
    } else {
      throw new Error("Unsupported text message type")
    }
  }

  serialize() {
    return {
      type: this.type,
      content: this.content,
      contact: this.contact,
      target: this.target,
      timestamp: this.timestamp,
    }
  }
}

export class LocationMessage implements ILocationMessage {
  type: MessageTypeEnum
  target: WAMessage
  contact: ContactDTO
  timestamp: number
  degreesLatitude: number
  degreesLongitude: number

  constructor(wMessage: WAMessage) {
    this.target = wMessage
    this.type = MessageTypeEnum.Location
    this.contact = new ContactDTO(wMessage)
    this.timestamp = wMessage.messageTimestamp as number

    const message =
      wMessage.message?.liveLocationMessage || wMessage.message?.locationMessage

    if (!message?.degreesLatitude || !message?.degreesLongitude) {
      throw new UnsupportedMessageTypeError("Location message not found")
    }
    this.degreesLatitude = message?.degreesLatitude
    this.degreesLongitude = message?.degreesLongitude
  }

  serialize(): ILocationMessage {
    return {
      type: this.type,
      contact: this.contact,
      target: this.target,
      timestamp: this.timestamp,
      degreesLatitude: this.degreesLatitude,
      degreesLongitude: this.degreesLongitude,
    }
  }
}

export abstract class MediaMessageDTO extends MessageDTO {
  get fileName() {
    return `${this.target?.key?.id}-${this.target?.key?.remoteJid}`
  }
  abstract get mimeType(): string
  abstract get filePath(): string

  serialize() {
    return {
      type: this.type,
      content: this.content,
      contact: this.contact,
      target: this.target,
      mimeType: this.mimeType,
      filePath: this.filePath,
      fileName: this.fileName,
      timestamp: this.timestamp,
    }
  }
}

export class DocumentMediaMessageDTO
  extends MediaMessageDTO
  implements IMediaMessage
{
  get message() {
    return this.type === MessageTypeEnum.DocumentWithCaption
      ? this.target.message?.documentWithCaptionMessage?.message
          ?.documentMessage
      : this.target.message?.documentMessage
  }

  get content(): string {
    return this.message?.caption || ""
  }

  get mimeType(): string {
    return this.message?.mimetype || ""
  }

  get filePath(): string {
    return `/document/${this.fileName}.${this.fileExtension}`
  }

  get fileExtension(): string {
    const mimeExtensions: Record<string, string> = {
      "application/pdf": "pdf",
      "application/msword": "doc",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        "docx",
      "application/vnd.ms-excel": "xls",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        "xlsx",
    }

    return mimeExtensions[this.mimeType]
  }
}

export class ImageMediaMessageDTO
  extends MediaMessageDTO
  implements IMediaMessage
{
  get message() {
    return this.target.message?.imageMessage
  }

  get content(): string {
    return this.message?.caption || ""
  }

  get mimeType(): string {
    return this.message?.mimetype || "image/jpeg"
  }

  get filePath(): string {
    return `/image/${this.fileName}.${this.fileExtension}`
  }

  get fileExtension(): string {
    return "jpg"
  }
}

export class VideoMediaMessageDTO
  extends MediaMessageDTO
  implements IMediaMessage
{
  get message() {
    return this.target.message?.videoMessage
  }

  get content(): string {
    return this.message?.caption || ""
  }

  get mimeType(): string {
    return this.message?.mimetype || "video/mp4"
  }

  get fileExtension(): string {
    return this.mimeType.split("/")[1]
  }

  get filePath(): string {
    return `/video/${this.fileName}.${this.fileExtension}`
  }
}

export class AudioMediaMessageDTO
  extends MediaMessageDTO
  implements IMediaMessage
{
  private _content: string

  get message() {
    return this.target.message?.audioMessage
  }

  set content(value: string) {
    this._content = value
  }

  get content(): string {
    return this._content || ""
  }

  get mimeType(): string {
    return this.message?.mimetype || "audio/mpeg"
  }

  get fileExtension(): string {
    return "mp3"
  }

  get filePath(): string {
    return `/audio/${this.fileName}.${this.fileExtension}`
  }
}

export class MediaMessageFactory {
  static getMessageType(wMessage: WAMessage): MessageTypeEnum {
    return (
      Object.values(MessageTypeEnum).find(type => {
        const propValue =
          wMessage?.message?.[type as keyof typeof wMessage.message]
        return propValue != null // ou !== undefined
      }) || MessageTypeEnum.Unknown
    )
  }

  static createMessage(wMessage: WAMessage) {
    const messageType = MediaMessageFactory.getMessageType(wMessage)

    switch (messageType) {
      case MessageTypeEnum.ExtendedText:
      case MessageTypeEnum.Conversation:
        return new TextMessage(wMessage, messageType)
      case MessageTypeEnum.Document:
      case MessageTypeEnum.DocumentWithCaption:
        return new DocumentMediaMessageDTO(wMessage, messageType)
      case MessageTypeEnum.Image:
        return new ImageMediaMessageDTO(wMessage, messageType)
      case MessageTypeEnum.Video:
        return new VideoMediaMessageDTO(wMessage, messageType)
      case MessageTypeEnum.Audio:
        return new AudioMediaMessageDTO(wMessage, messageType)
      case MessageTypeEnum.LiveLocation:
      case MessageTypeEnum.Location:
        return new LocationMessage(wMessage)
      default:
        throw new UnsupportedMessageTypeError("Unsupported media message type")
    }
  }
}
