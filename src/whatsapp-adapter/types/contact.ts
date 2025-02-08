import { WAMessage } from "@whiskeysockets/baileys"
import { MessageTypeEnum } from "./message-type.enum"

export interface IContact {
  id: string
  name: string
  number: string
  isGroup: boolean
  isMe: boolean
}

export class ContactDTO implements IContact {
  id: string
  name: string
  number: string
  isGroup: boolean
  isMe: boolean

  constructor(wMessage: WAMessage) {
    const id = wMessage.key?.remoteJid

    if (!id) {
      throw new Error("Remote JID not found")
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
}

export interface IMediaMessage extends IMessage {
  fileName: string
  filePath: string
  mimeType: string
}

export abstract class MessageDTO implements IMessage {
  target: WAMessage
  type: MessageTypeEnum

  constructor(wMessage: WAMessage, type: MessageTypeEnum) {
    this.target = wMessage
    this.type = type
  }

  abstract get content(): string
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
}

export abstract class MediaMessageDTO extends MessageDTO {
  get fileName() {
    return `${this.target?.key?.id}-${this.target?.key?.remoteJid}`
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
    return this.mimeType.split("/")[1]
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
  get message() {
    return this.target.message?.audioMessage
  }

  get content(): string {
    return ""
  }

  get mimeType(): string {
    return this.message?.mimetype || "audio/mpeg"
  }

  get fileExtension(): string {
    return this.mimeType.split("/")[1]
  }

  get filePath(): string {
    return `/audio/${this.fileName}.${this.fileExtension}`
  }
}

export class MediaMessageFactory {
  static getMessageType(wMessage: WAMessage): MessageTypeEnum {
    return (
      Object.values(MessageTypeEnum).find(type =>
        Reflect.has(wMessage?.message ?? {}, type),
      ) || MessageTypeEnum.Unknown
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
      default:
        throw new Error("Unsupported media message type")
    }
  }
}
