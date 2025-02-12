import { forwardRef, Inject, Injectable, Logger } from "@nestjs/common"
import { proto, WAPresence, WASocket } from "@whiskeysockets/baileys"
import { WhatsappConnectService } from "./whatsapp-connection.service"

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

  async send(contactId: string, message: string) {
    try {
      await this.sendMessage(contactId, message)
    } catch (error) {
      this.logger.error(`Falha ao enviar mensagem: ${(error as Error).message}`)
    }
  }

  async setPresence(presence: WAPresence, toId: string) {
    const socket = await this.connectionService.getSocket()
    socket.sendPresenceUpdate(presence, toId)
  }

  async setMessagesRead(keys: proto.IMessageKey[]) {
    const socket = await this.connectionService.getSocket()
    socket.readMessages(keys)
  }

  async sendMessage(jid: string, message: string) {
    const socket = await this.connectionService.getSocket()
    await socket.sendMessage(jid, { text: message })
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
