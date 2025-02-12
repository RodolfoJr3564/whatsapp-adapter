import { Controller } from "@nestjs/common"
import { Ctx, MessagePattern, Payload, RmqContext } from "@nestjs/microservices"
import { WhatsappMessageSenderService } from "./whatsapp-message-sender.service"
import { ISendMessage } from "./types/send-message"

@Controller("message")
export class WhatsappAdapterController {
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
      console.log("🔵 Enviando mensagem:", data)
      await this.messageSenderService.sendMessage(data.contactId, data.content)
      channel.ack(originalMsg)
    } catch (error) {
      console.error("❌ Erro ao processar mensagem:", error)
      channel.nack(originalMsg, false, false)
    }
  }
}
