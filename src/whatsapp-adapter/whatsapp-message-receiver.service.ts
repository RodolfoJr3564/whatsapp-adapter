import { forwardRef, Inject, Injectable, Logger } from "@nestjs/common"
import { WAMessage, downloadMediaMessage } from "@whiskeysockets/baileys"
import { MinioService } from "object-storage/minio.service"
import pino from "pino"
import { ConfigService } from "@nestjs/config"
import { RabbitmqConfig, StorageConfig } from "config/configurations.interface"
import { WhatsappMessageSenderService } from "./whatsapp-message-sender.service"
import { WhatsappConnectService } from "./whatsapp-connection.service"
import {
  IMediaMessage,
  MediaMessageDTO,
  MediaMessageFactory,
} from "./types/message"
import {
  UnsupportedMessageTypeError,
  UnsupportedMessageTypeWithoutResponseError,
} from "./types/custom-errors"
import { ClientProxy } from "@nestjs/microservices"
import axios from "axios"
import * as FormData from "form-data"
import { MessageTypeEnum } from "./types/message-type.enum"
@Injectable()
export class WhatsappMessageReceiverService {
  private readonly logger = new Logger(WhatsappMessageReceiverService.name)
  private readonly pinoLogger = pino()
  private bucketName: string
  private readonly whatsappReceivedMessageQueue: string
  private readonly openaiAPIKey: string

  constructor(
    private readonly storage: MinioService,
    @Inject("DISPATCH_RECEIVED_MESSAGE_CLIENT")
    private readonly dispatchReceivedMessageClient: ClientProxy,
    private readonly configService: ConfigService,
    private readonly messageSenderService: WhatsappMessageSenderService,
    @Inject(forwardRef(() => WhatsappConnectService))
    private readonly connectionService: WhatsappConnectService,
  ) {
    const storageConfig = this.configService.get<StorageConfig>(
      "storage",
    ) as StorageConfig
    const rabbitmqConfig = this.configService.get<RabbitmqConfig>("rabbitmq")
    if (!rabbitmqConfig) {
      throw new Error("RabbitMQ configuration not found")
    }
    this.whatsappReceivedMessageQueue =
      rabbitmqConfig.whatsappReceivedMessageQueue
    this.bucketName = storageConfig.bucketName
    this.messageSenderService = messageSenderService
    this.connectionService = connectionService
    const openaiAPIKey = this.configService.get<string>("openaiAPIKey")
    if (!openaiAPIKey) {
      throw new Error("OpenAI API Key not found")
    }
    this.openaiAPIKey = openaiAPIKey
  }

  receive(receivedChat: { messages: WAMessage[] }) {
    this.receiveMessage(receivedChat).catch(error => {
      this.logger.error(
        `Erro ao tratar a mensagem: ${(error as Error)?.message}`,
      )
    })
  }

  async receiveMessage(receivedChat: { messages: WAMessage[] }) {
    await this.messageSenderService.setMessagesRead(receivedChat.messages)

    for (const message of receivedChat.messages) {
      try {
        console.log("Mensagem recebida: ", message)
        const createdMessage = await this.createMessage(message)
        await this.messageSenderService.setMessagesRead([message.key])
        this.dispatchReceivedMessageClient.emit(
          this.whatsappReceivedMessageQueue,
          createdMessage.serialize(),
        )
        this.logger.log(
          `Mensagem enviada para: ${this.whatsappReceivedMessageQueue}`,
        )
      } catch (error) {
        let response
        if (
          error instanceof UnsupportedMessageTypeWithoutResponseError ||
          error instanceof UnsupportedMessageTypeError
        ) {
          this.logger.error(`Erro ao processar mensagem: ${error.message}`)
          response =
            "🚫 *Desculpe, houve um erro ao processar sua última mensagem.* 😓" +
            "\n> Parece que não é possível processar este tipo de mensagem. 🤔"
        }

        if (message.key.remoteJid) {
          await this.messageSenderService.sendMessage(
            message.key.remoteJid,
            response ||
              "⚠️ *Parece haver algum problema em nossos servidores!*\n" +
                "🌐 Por favor, tente novamente em algumas horas. ⏳",
          )
        }

        this.logger.error(error)
      }
    }
  }

  private async createMessage(wMessage: WAMessage) {
    const message = MediaMessageFactory.createMessage(wMessage)

    if (message instanceof MediaMessageDTO) {
      await this.retrieveAndSaveMedia(wMessage, message)
    }

    return message
  }

  private async retrieveAndSaveMedia(
    wMessage: WAMessage,
    message: IMediaMessage,
  ) {
    const socket = await this.connectionService.getSocket()
    const buffer = await downloadMediaMessage(
      wMessage,
      "buffer",
      {},
      {
        reuploadRequest: socket.updateMediaMessage.bind(socket),
        logger: this.pinoLogger,
      },
    )
    if (message.type === MessageTypeEnum.Audio) {
      message.content = await this.transcribeAudio(buffer, message.mimeType)
    }

    return this.storage.uploadFile(
      message.filePath,
      buffer,
      message.mimeType,
      this.bucketName,
    )
  }

  private async transcribeAudio(buffer: Buffer, mimeType: string) {
    const url = "https://api.openai.com/v1/audio/transcriptions"

    try {
      const formData = new FormData()
      formData.append("file", buffer, {
        filename: "audio.mp3", // nome do arquivo
        contentType: mimeType,
      })
      formData.append("model", "whisper-1")
      formData.append("language", "pt")
      formData.append(
        "prompt",
        "Transcreva o áudio. Você está obtendo um áudio de um cidadão descrevendo um incidente, que pode ser um assalto, acidente, ou outro tipo de ocorrência. Por favor, transcreva o áudio.",
      )

      const response = await axios.post(url, formData, {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${this.openaiAPIKey}`,
        },
      })
      console.log(response)
      return response.data.text
    } catch (error: any) {
      console.error(
        "Erro na transcrição:",
        error.response?.data || error.message,
      )
      return null
    }
  }
}
