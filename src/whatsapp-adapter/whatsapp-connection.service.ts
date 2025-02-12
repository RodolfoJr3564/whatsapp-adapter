import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common"
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  AuthenticationState,
  ConnectionState,
} from "@whiskeysockets/baileys"

import { toString as qrCodeToString } from "qrcode"
import * as fs from "fs"
import { resolve as resolvePath } from "path"
import { WhatsappMessageReceiverService } from "./whatsapp-message-receiver.service"

interface AuthState {
  state: AuthenticationState
  saveCreds: () => Promise<void>
}

@Injectable()
export class WhatsappConnectService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsappConnectService.name)
  private socket: WASocket | null = null
  private credentialsFilePath = resolvePath("auth_info_baileys")

  private retryAttempts = 0
  private maxRetries = 100
  private backoffFactor = 2000

  constructor(
    private readonly messageReceiver: WhatsappMessageReceiverService,
  ) {}

  async onModuleInit() {
    await this.connectToWhatsApp()
  }

  onModuleDestroy() {
    this.closeConnection()
  }

  async getSocket() {
    if (!this.socket) {
      this.logger.log("Socket não encontrado. Tentando conectar...")
      await this.connectToWhatsApp()
    }
    return this.socket as WASocket
  }

  async connectToWhatsApp() {
    try {
      const authState: AuthState = await useMultiFileAuthState(
        this.credentialsFilePath,
      )

      if (!authState?.state || !authState?.saveCreds) {
        this.logger.error("Falha ao atualizar credenciais.")
        return this.shutdownApp()
      }

      const sock = makeWASocket({
        emitOwnEvents: false,
        printQRInTerminal: true,
        auth: authState.state,
        markOnlineOnConnect: true,
        syncFullHistory: false,
        fireInitQueries: false,
        connectTimeoutMs: 5000,
        retryRequestDelayMs: 1000,
        maxMsgRetryCount: 5,
      })

      this.socket = sock
      this.retryAttempts = 0

      this.setupEventListeners(sock, authState)
    } catch (error) {
      this.logger.error(
        `Erro ao conectar ao WhatsApp: ${error instanceof Error ? error.message : error}`,
      )

      this.retryOrShutdown()
    }
  }

  private setupEventListeners(sock: WASocket, authState: AuthState) {
    sock.ev.on("creds.update", () => {
      authState
        .saveCreds()
        .catch(err => this.logger.error("Erro ao salvar credenciais:", err))
    })

    sock.ev.on("connection.update", update =>
      this.handleConnectionUpdate(update),
    )

    sock.ev.on("messages.upsert", message => {
      this.messageReceiver.receive(message)
    })
  }

  private handleConnectionUpdate(update: Partial<ConnectionState>) {
    this.logger.warn(`Atualização de conexão: ${JSON.stringify(update)}`)

    const { connection, lastDisconnect, qr } = update

    if (connection === "close") {
      const error = lastDisconnect?.error
      let errorCode = DisconnectReason.connectionClosed

      if (error) {
        const errorWithCode = error as {
          output?: { statusCode?: number }
          code?: number
        }
        errorCode =
          errorWithCode?.output?.statusCode || errorWithCode?.code || errorCode
      }

      if (errorCode === DisconnectReason.loggedOut) {
        this.logger.error("Desconectado do WhatsApp. Removendo credenciais.")
        this.deleteAuthState()
        this.retryOrShutdown()
      } else {
        this.retryOrShutdown()
      }
    } else if (connection === "open") {
      this.logger.log("Conexão com WhatsApp estabelecida com sucesso.")
      this.retryAttempts = 0
    }

    if (qr) {
      this.displayQRCode(qr)
    }
  }

  private retryOrShutdown() {
    if (this.retryAttempts >= this.maxRetries) {
      this.logger.error(
        "Número máximo de tentativas de reconexão atingido. Encerrando aplicação.",
      )
      return this.shutdownApp()
    }

    this.retryAttempts++
    const delay = Math.min(this.backoffFactor * this.retryAttempts, 30000)
    this.logger.warn(`Tentando reconectar em ${delay / 1000} segundos...`)
    this.logger.warn(
      `Tentativas restantes: ${this.maxRetries - this.retryAttempts}`,
    )

    this.closeConnection(false)

    setTimeout(() => {
      this.connectToWhatsApp()
    }, delay)
  }

  private deleteAuthState() {
    try {
      if (fs.existsSync(this.credentialsFilePath)) {
        fs.rmSync(this.credentialsFilePath, { recursive: true, force: true })
        this.logger.log("Credenciais removidas com sucesso.")
      }
    } catch (error) {
      this.logger.error("Erro ao remover credenciais:", error)
    }
  }

  closeConnection(logInfo = true) {
    if (this.socket) {
      this.clearSockListeners()
      if (logInfo) {
        this.logger.warn("Fechando conexão com o WhatsApp.")
      }
      try {
        this.socket.ws.close()
      } catch (err) {
        this.logger.error("Erro ao fechar socket:", err)
      }
      this.clearSock()
      if (logInfo) {
        this.logger.warn("Listeners removidos e socket limpo.")
      }
    }
  }

  clearSockListeners() {
    if (this.socket) {
      this.socket.ev.removeAllListeners("creds.update")
      this.socket.ev.removeAllListeners("connection.update")
      this.socket.ev.removeAllListeners("messages.upsert")
      this.socket.ev.removeAllListeners("presence.update")
    }
  }

  clearSock() {
    this.socket = null
  }

  private shutdownApp() {
    this.logger.log("Encerrando aplicação.")
    this.closeConnection()
    process.exit(1)
  }

  private displayQRCode(qr: string) {
    qrCodeToString(qr, { type: "terminal", small: true }, (err, url) => {
      if (err) {
        this.logger.error("Falha ao gerar QR Code:", err)
        return
      }
      console.log()
      console.log(url)
      console.log()
    })
  }
}
