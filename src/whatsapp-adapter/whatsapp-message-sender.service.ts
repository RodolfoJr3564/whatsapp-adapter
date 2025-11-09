import { forwardRef, Inject, Injectable, Logger } from "@nestjs/common"
import { proto, WAPresence, WASocket } from "@whiskeysockets/baileys"
import { WhatsappConnectService } from "./whatsapp-connection.service"
import { formatPhoneToJid } from "./utils/phone-formatter.util"

@Injectable()
export class WhatsappMessageSenderService {
  private readonly logger = new Logger(WhatsappMessageSenderService.name)
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
    @Inject(forwardRef(() => WhatsappConnectService))
    private readonly connectionService: WhatsappConnectService,
  ) {
    this.connectionService = connectionService
  }

  async send(phoneNumber: string, message: string) {
    try {
      await this.sendMessage(phoneNumber, message)
    } catch (error) {
      this.logger.error(`Falha ao enviar mensagem: ${(error as Error).message}`)
    }
  }

  async setPresence(presence: WAPresence, toId: string) {
    const socket = await this.connectionService.getSocket()
    const jid = formatPhoneToJid(toId)
    socket.sendPresenceUpdate(presence, jid)
  }

  async setMessagesRead(keys: proto.IMessageKey[]) {
    const socket = await this.connectionService.getSocket()
    socket.readMessages(keys)
  }

  async sendMessage(phoneNumber: string, message: string) {
    const socket = await this.connectionService.getSocket()
    const jid = formatPhoneToJid(phoneNumber)

    this.logger.debug(`Enviando mensagem para ${phoneNumber} -> ${jid}`)
    await socket.sendMessage(jid, { text: message })
  }

  async sendReactionMessage(
    sock: WASocket,
    phoneNumber: string,
    text: string,
    messageKey: proto.IMessageKey,
  ) {
    try {
      const jid = formatPhoneToJid(phoneNumber)
      await sock.sendMessage(jid, { react: { text, key: messageKey } })
    } catch (error) {
      this.logger.error(
        `Erro ao enviar reação para ${phoneNumber}: ${(error as Error).message}`,
      )
    }
  }
}
