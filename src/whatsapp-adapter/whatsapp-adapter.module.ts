import { Module } from "@nestjs/common"
import { WhatsappConnectService } from "./whatsapp-connection.service"
import { MinioModule } from "object-storage/minio.module"
import { ConfigModule } from "@nestjs/config"
import { WhatsappMessageReceiverService } from "./whatsapp-message-receiver.service"
import { WhatsappMessageSenderService } from "./whatsapp-message-sender.service"
import { RabbitmqModule } from "queue/rabbit.module"
import { WhatsappAdapterController } from "./whatsapp-adapter.controller"

@Module({
  imports: [MinioModule, ConfigModule, RabbitmqModule],
  providers: [
    WhatsappConnectService,
    WhatsappMessageReceiverService,
    WhatsappMessageSenderService,
  ],
  exports: [WhatsappConnectService],
  controllers: [WhatsappAdapterController],
})
export class WhatsappAdapterModule {}
