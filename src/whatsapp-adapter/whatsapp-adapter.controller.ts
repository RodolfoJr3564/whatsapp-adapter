import { Body, Controller, Post } from "@nestjs/common"
import { MessagePattern, Payload } from "@nestjs/microservices"
import { RabbitmqService } from "queue/rabbit.service"
import { WhatsappMessageSenderService } from "./whatsapp-message-sender.service"
import { MessageDTO } from "./types/message"

@Controller("message")
export class WhatsappAdapterController {
  constructor(
    private readonly rabbitService: RabbitmqService,
    private readonly messageSenderService: WhatsappMessageSenderService,
  ) {}

  @Post("received-message")
  receiveMessage(@Body() data: any) {
    return this.rabbitService.emit("whatsapp.received.message", data)
  }

  @MessagePattern("whatsapp.received.message")
  processMessage(@Payload() data: MessageDTO) {
    return this.rabbitService.emit("whatsapp.send.message", data)
  }

  @Post("send-message")
  sendMessage(@Body() data: any) {
    return this.rabbitService.emit("whatsapp.send.message", data)
  }

  @MessagePattern("whatsapp.send.message")
  processSendMessage(@Payload() data: MessageDTO) {
    console.log("Sending message", data)
    return this.messageSenderService.sendMessage(
      data?.contact.id,
      data?.content,
    )
  }
}
