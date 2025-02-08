import { Injectable, Logger } from "@nestjs/common"
import {
  proto,
  WASocket,
  WAMessage,
  downloadMediaMessage,
  MessageUpsertType,
} from "@whiskeysockets/baileys"

import { InjectModel } from "@nestjs/mongoose"
import { Model } from "mongoose"

import { MinioService } from "object-storage/minio.service"
import pino from "pino"
import { ConfigService } from "@nestjs/config"
import { AppConfig } from "config/configurations.interface"
import { Message, MessageDocument } from "message/message.schema"
import { Contact, ContactDocument } from "contact/contact.schema"
import { MessageTypeEnum } from "whatsapp-adapter/message-type.enum"

export type BaileysReceivedChat = {
  messages: WAMessage[]
  type: MessageUpsertType
  requestId?: string
}

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

@Injectable()
export class WhatsappMessageReceiverService {
  private readonly logger = new Logger(WhatsappMessageReceiverService.name)
  private readonly pinoLogger = pino()
  private bucketName: string
  public static emojiMap = {
    ":like:": "👍",
    ":thinking:": "🤔",
    ":cool:": "😎",
    ":check:": "✔️",
    ":eyes:": "👀",
    ":thanks": "🙏",
    ":smile:": "😊",
  }

  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(Contact.name) private contactModel: Model<ContactDocument>,
    private readonly storage: MinioService,
    private readonly configService: ConfigService,
  ) {
    const bucketName =
      this.configService.get<AppConfig["storage"]["bucketName"]>(
        "storage.bucketName",
      )
    if (!bucketName) {
      throw new Error("Configuração de storage não encontrada.")
    }

    this.bucketName = bucketName
  }

  receive(receivedChat: BaileysReceivedChat) {
    this.receiveMessage(receivedChat).catch(error => {
      this.logger.error(
        `Erro ao tratar a mensagem: ${(error as Error)?.message}`,
      )
    })
  }

  private async findOrCreateContact(wMessage: WAMessage) {
    if (!wMessage.key)
      throw new Error(
        `Alguma coisa deu errado ao tentar encontrar/criar o contato ${JSON.stringify(wMessage)}`,
      )
    const contactId = wMessage.key.remoteJid
    let contact = await this.contactModel.findOne({
      whatsappContactId: contactId,
    })

    if (!contact) {
      contact = await this.contactModel.create({
        whatsappContactId: wMessage.key.remoteJid,
        whatsappContactName:
          wMessage.pushName || wMessage.verifiedBizName || "",
        number: wMessage.key?.remoteJid?.split("@")[0],
        isGroup: wMessage.key?.remoteJid?.endsWith("@g.us"),
        fromMe: wMessage.key?.fromMe || false,
      })
    }

    return contact
  }

  async getContact(whatsappContactId: string) {
    return this.contactModel.findOne({ whatsappContactId })
  }

  async updateContact(
    whatsappContactId: string,
    data: {
      firstName: string
      lastName: string
      email: string
      number: string
    },
  ) {
    return this.contactModel.updateOne({ whatsappContactId }, { $set: data })
  }

  private getMessageType(wMessage: WAMessage): MessageTypeEnum {
    return (
      Object.values(MessageTypeEnum).find(type =>
        wMessage?.message?.hasOwnProperty(type),
      ) || MessageTypeEnum.Unknown
    )
  }

  private getMessageFileName(wMessage: WAMessage) {
    return `${wMessage?.key?.id}-${wMessage?.key?.remoteJid}`
  }

  private handleTextMessage(
    wMessage: WAMessage,
    messageType: MessageTypeEnum.ExtendedText | MessageTypeEnum.Conversation,
  ) {
    const messageContent =
      messageType === MessageTypeEnum.ExtendedText
        ? wMessage?.message?.[MessageTypeEnum.ExtendedText]?.text
        : wMessage?.message?.[MessageTypeEnum.Conversation]

    if (!messageContent) {
      throw new UnsupportedMessageTypeWithoutResponseError(
        `Mensagem de texto não encontrada. Tipo de mensagem: ${messageType}` +
          `Mensagem: ${JSON.stringify(wMessage)}`,
      )
    }

    return messageContent
  }

  private async handleImageMessage(message: WAMessage) {
    if (!this.socket) {
      throw new Error("Socket não está conectado.")
    }

    try {
      const buffer = await downloadMediaMessage(
        message,
        "buffer",
        {},
        {
          reuploadRequest: this.socket.updateMediaMessage.bind(this.socket),
          logger: this.pinoLogger,
        },
      )

      const mimeType = message.message?.imageMessage?.mimetype || "image/jpeg"
      const fileName = `/image/${this.getMessageFileName(message)}.jpg`

      const objectName = await this.storage.uploadFile(
        fileName,
        buffer,
        mimeType,
        this.bucketName,
      )
      return {
        objectName,
        mimeType,
        content: message.message?.imageMessage?.caption || "",
      }
    } catch (error) {
      this.logger.error("Erro ao processar imagem:", error)
      throw error
    }
  }

  private async handleVideoMessage(wMessage: WAMessage) {
    if (!this.socket) {
      throw new Error("Socket não está conectado.")
    }

    try {
      const buffer = await downloadMediaMessage(
        wMessage,
        "buffer",
        {},
        {
          reuploadRequest: this.socket.updateMediaMessage.bind(this.socket),
          logger: this.pinoLogger,
        },
      )

      const mimeType = wMessage.message?.videoMessage?.mimetype || "video/mp4"
      const fileName = `/video/${this.getMessageFileName(wMessage)}.mp4`
      const objectName = await this.storage.uploadFile(
        fileName,
        buffer,
        mimeType,
        this.bucketName,
      )

      return {
        objectName,
        mimeType,
        content: wMessage.message?.videoMessage?.caption || "",
      }
    } catch (error) {
      this.logger.error("Erro ao processar vídeo:", error)
      throw error
    }
  }

  private async handleAudioMessage(wMessage: WAMessage) {
    if (!this.socket) {
      throw new Error("Socket não está conectado.")
    }

    try {
      const buffer = await downloadMediaMessage(
        wMessage,
        "buffer",
        {},
        {
          reuploadRequest: this.socket.updateMediaMessage.bind(this.socket),
          logger: this.pinoLogger,
        },
      )

      const mimeType = wMessage.message?.audioMessage?.mimetype || "audio/mpeg"
      const fileName = `/audio/${this.getMessageFileName(wMessage)}.mp3`

      const objectName = await this.storage.uploadFile(
        fileName,
        buffer,
        mimeType,
        this.bucketName,
      )
      return {
        objectName,
        mimeType,
        content: "",
      }
    } catch (error) {
      this.logger.error("Erro ao processar áudio:", error)
      throw error
    }
  }

  private async handleDocumentMessage(wMessage: WAMessage) {
    if (!this.socket) {
      throw new Error("Socket não está conectado.")
    }

    try {
      const buffer = await downloadMediaMessage(
        wMessage,
        "buffer",
        {},
        {
          reuploadRequest: this.socket.updateMediaMessage.bind(this.socket),
          logger: this.pinoLogger,
        },
      )

      const documentMessage = MessageTypeEnum.DocumentWithCaption
        ? wMessage.message?.documentWithCaptionMessage?.message?.documentMessage
        : wMessage.message?.documentMessage
      const mimeType = documentMessage?.mimetype || "application/pdf"
      const fileName = `/document/${this.getMessageFileName(wMessage)}.${this.getFileExtension(mimeType)}`

      const objectName = await this.storage.uploadFile(
        fileName,
        buffer,
        mimeType,
        this.bucketName,
      )

      return {
        objectName,
        mimeType,
        content: documentMessage?.caption || "",
      }
    } catch (error) {
      this.logger.error("Erro ao processar documento:", error)
      throw error
    }
  }

  private getFileExtension(mimeType: string): string {
    const mimeExtensions: Record<string, string> = {
      "application/pdf": "pdf",
      "application/msword": "doc",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        "docx",
      "application/vnd.ms-excel": "xls",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        "xlsx",
    }

    return mimeExtensions[mimeType] || "bin"
  }

  private async createMessage(wMessage: WAMessage) {
    const messageType = this.getMessageType(wMessage)
    const contact = await this.findOrCreateContact(wMessage)

    if (
      messageType === MessageTypeEnum.ExtendedText ||
      messageType === MessageTypeEnum.Conversation
    ) {
      const messageContent = this.handleTextMessage(wMessage, messageType)
      return this.messageModel.create({
        contact,
        timestamp: wMessage.messageTimestamp,
        type: messageType,
        content: messageContent,
        target: wMessage,
      })
    }

    let metadata
    switch (messageType) {
      case MessageTypeEnum.Image:
        metadata = await this.handleImageMessage(wMessage)
        break
      case MessageTypeEnum.Video:
        metadata = await this.handleVideoMessage(wMessage)
        break
      case MessageTypeEnum.Audio:
        metadata = await this.handleAudioMessage(wMessage)
        break
      case MessageTypeEnum.DocumentWithCaption:
        metadata = await this.handleDocumentMessage(wMessage)
        break
      case MessageTypeEnum.Document:
        metadata = await this.handleDocumentMessage(wMessage)
        break
      default:
        throw new UnsupportedMessageTypeError(
          `Tipo de mensagem não suportado: ${messageType}`,
        )
    }

    return this.messageModel.create({
      contact,
      timestamp: wMessage.messageTimestamp,
      type: messageType,
      content: metadata?.content || "",
      location: metadata.objectName,
      target: wMessage,
    })
  }

  // TODO: ignorar status@broadcast
  async receiveMessage(receivedChat: BaileysReceivedChat) {
    try {
      const messages = []

      for (const message of receivedChat.messages) {
        const createdMessage = await this.createMessage(message)
        messages.push(createdMessage)
        await this.setMessagesRead([message.key])
      }

      // TODO: this.chatHandlerService.handleChat(messages)
    } catch (error) {
      this.logger.error(
        `Erro ao tratar a mensagem: ${(error as Error)?.message}`,
      )

      let response =
        "⚠️ *Parece haver algum problema em nossos servidores!*\n" +
        "🌐 Por favor, tente novamente em algumas horas. ⏳"

      if (
        error instanceof UnsupportedMessageTypeWithoutResponseError ||
        error instanceof UnsupportedMessageTypeError
      ) {
        this.logger.error(`Erro ao processar mensagem: ${error.message}`)
        response =
          "🚫 *Desculpe, houve um erro ao processar sua última mensagem.* 😓" +
          "\n Parece que não é possível processar este tipo de mensagem. 🤔"
      }

      const jid = receivedChat.messages[0].key.remoteJid as string
      await this.sendMessage(jid, response)
    }
  }

  async reply(message: Message, response: string) {
    try {
      await this.sendMessage(message.contact.whatsappContactId, response)
    } catch (error) {
      this.logger.error(
        `Falha ao responder a mensagem: ${(error as Error).message}`,
      )
    }
  }

  async send(contactId: string, message: string) {
    try {
      await this.sendMessage(contactId, message)
    } catch (error) {
      this.logger.error(`Falha ao enviar mensagem: ${(error as Error).message}`)
    }
  }

  async setPresence(presence: WAPresence, toId: string) {
    const socket = await this.getSocket()
    socket.sendPresenceUpdate(presence, toId)
  }

  async setMessagesRead(keys: proto.IMessageKey[]) {
    const socket = await this.getSocket()
    socket.readMessages(keys)
  }

  async sendMessage(jid: string, message: string) {
    try {
      const socket = await this.getSocket()
      if (typeof message === "string") {
        await socket.sendMessage(jid, { text: message })
      } else {
        this.logger.error(
          `Tipo de mensagem "${typeof message}" não é uma string.`,
        )
      }
    } catch (error) {
      this.logger.error(
        `Erro ao enviar mensagem para ${jid}: ${(error as Error).message}`,
      )
    }
  }

  async sendReactionMessage(
    sock: WASocket,
    jid: string,
    text: string,
    messageKey: proto.IMessageKey,
  ) {
    try {
      await sock.sendMessage(jid, { react: { text, key: messageKey } })
    } catch (error) {
      this.logger.error(
        `Erro ao enviar reação para ${jid}: ${(error as Error).message}`,
      )
    }
  }
}
