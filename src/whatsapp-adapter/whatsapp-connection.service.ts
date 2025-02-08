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
  private messageReceiver: WhatsappMessageReceiverService

  constructor(messageReceiver: WhatsappMessageReceiverService) {
    this.messageReceiver = messageReceiver
  }

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

  async connectToWhatsApp(retryCount = this.maxRetries) {
    try {
      const authState: AuthState = await useMultiFileAuthState(
        this.credentialsFilePath,
      )

      if (!authState || !authState.state || !authState.saveCreds) {
        this.logger.error("Falha ao atualizar credenciais.")
        return this.shutdownApp()
      }

      const sock = makeWASocket({
        emitOwnEvents: false, // Emite eventos próprios
        printQRInTerminal: true, // Imprime o QR code no terminal para escaneamento
        auth: authState.state, // Estado de autenticação para manter a sessão
        markOnlineOnConnect: true, // Marca o cliente como online sempre que a conexão é estabelecida
        syncFullHistory: false, // Desativa a sincronização completa do histórico de mensagens
        fireInitQueries: false, // Não dispara automaticamente consultas iniciais para otimizar a conexão
        connectTimeoutMs: 5000, // Tempo limite de conexão (5 segundos) para detectar problemas de conexão rapidamente
        retryRequestDelayMs: 1000, // Tempo entre tentativas de reenvio de mensagens (1 segundo)
        maxMsgRetryCount: 5, // Número máximo de tentativas de reenvio de mensagens
      })

      this.socket = sock

      this.retryAttempts = 0

      this.setupEventListeners(sock, authState, retryCount)
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(`Erro ao conectar ao WhatsApp: ${error.message}`)
      } else {
        this.logger.error(`Erro ao conectar ao WhatsApp: ${String(error)}`)
      }
      this.handleReconnection(retryCount)
    }
  }

  private setupEventListeners(
    sock: WASocket,
    authState: AuthState,
    retryCount: number,
  ) {
    sock.ev.on("creds.update", () => {
      authState
        .saveCreds()
        .catch(error => this.logger.error("Erro ao salvar credenciais:", error))
    })

    sock.ev.on("connection.update", update =>
      this.handleConnectionUpdate(update, retryCount),
    )

    sock.ev.on("messages.upsert", message =>
      this.messageReceiver.receive(message),
    )
  }

  private handleConnectionUpdate(
    connectionStateChange: Partial<ConnectionState>,
    retryCount: number,
  ) {
    this.logger.warn(
      `Atualização de conexão: ${JSON.stringify(connectionStateChange)}`,
    )

    if (connectionStateChange.connection === "close") {
      const connectionCloseError = connectionStateChange?.lastDisconnect?.error

      let connectionCloseErrorCode = DisconnectReason.connectionClosed
      if (connectionCloseError) {
        const errorWithCode = connectionCloseError as {
          output?: { statusCode?: number }
          code?: number
        }
        connectionCloseErrorCode =
          errorWithCode?.output?.statusCode ||
          errorWithCode?.code ||
          connectionCloseErrorCode
      }

      if (connectionCloseErrorCode === DisconnectReason.loggedOut) {
        this.logger.error("Desconectado do WhatsApp. Removendo credenciais.")
        this.deleteAuthState()

        this.logger.warn("Tentando reconectar em 5 segundos...")
        setTimeout(() => {
          this.connectToWhatsApp(retryCount - 1)
        }, 5000)
      } else if (retryCount > 0) {
        this.retryAttempts++
        const delay = Math.min(this.backoffFactor * this.retryAttempts, 30000) // Limitar a 30 segundos
        this.logger.warn(`Tentando reconectar em ${delay / 1000} segundos...`)
        this.logger.error(`Tentativas restantes: ${retryCount}`)
        setTimeout(() => {
          this.connectToWhatsApp(retryCount - 1)
        }, delay)
      } else {
        this.logger.error(
          "Número máximo de tentativas de reconexão atingido. Encerrando aplicação.",
        )
        return this.shutdownApp()
      }
    } else if (connectionStateChange.connection === "open") {
      this.logger.log("Conexão com WhatsApp estabelecida com sucesso.")
    }

    if (connectionStateChange.qr) {
      this.displayQRCode(connectionStateChange.qr)
    }
  }

  private handleReconnection(retryCount: number) {
    if (retryCount > 0) {
      this.retryAttempts++
      const delay = Math.min(this.backoffFactor * this.retryAttempts, 30000)
      this.logger.warn(`Tentando reconectar em ${delay / 1000} segundos...`)
      this.logger.error(`Tentativas restantes: ${retryCount}`)
      setTimeout(() => {
        this.connectToWhatsApp(retryCount - 1)
      }, delay)
    } else {
      this.logger.error(
        "Número máximo de tentativas de reconexão atingido. Encerrando aplicação.",
      )
      this.shutdownApp()
    }
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

  closeConnection() {
    if (this.socket) {
      this.clearSockListeners()
      this.logger.warn("Fechando conexão com o WhatsApp.")
      this.socket.ws.close()
      this.clearSock()
      this.logger.warn("Listeners removidos.")
    }
  }

  private shutdownApp() {
    this.logger.log("Encerrando aplicação.")
    this.closeConnection()
    process.exit(1)
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

  private displayQRCode(qr: string) {
    qrCodeToString(qr, { type: "terminal", small: true }, (err, url) => {
      if (err) {
        this.logger.error("Falha ao gerar QR Code.")
        return
      }
      console.log()
      console.log(url)
      console.log()
    })
  }
}
