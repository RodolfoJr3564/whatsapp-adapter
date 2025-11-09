import { Controller, Logger } from "@nestjs/common"
import { Ctx, MessagePattern, Payload, RmqContext } from "@nestjs/microservices"
import { WhatsappMessageSenderService } from "./whatsapp-message-sender.service"
import { ISendMessage } from "./types/send-message"

@Controller("whatsapp")
export class WhatsappAdapterController {
  private readonly logger = new Logger(WhatsappAdapterController.name)

  constructor(
    private readonly messageSenderService: WhatsappMessageSenderService,
  ) {}

  @MessagePattern("whatsapp.adapter.send.message.queue")
  async processSendMessage(
    @Payload() data: ISendMessage,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    const channel = context.getChannelRef()
    const originalMsg = context.getMessage()
    try {
      this.logger.log(`� [QUEUE] Enviando mensagem para: ${data.phoneNumber}`)
      await this.messageSenderService.sendMessage(
        data.phoneNumber,
        data.content,
      )
      channel.ack(originalMsg)
    } catch (error) {
      this.logger.error(
        `❌ [QUEUE] Erro ao processar mensagem: ${(error as Error).message}`,
      )
      channel.nack(originalMsg, false, false)
    }
  }
}
