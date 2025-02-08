import { Module } from "@nestjs/common"
import { WhatsappConnectService } from "./whatsapp-connection.service"
import { MinioModule } from "object-storage/minio.module"
import { ConfigModule } from "@nestjs/config"
import { WhatsappMessageReceiverService } from "./whatsapp-message-receiver.service"
import { WhatsappMessageSenderService } from "./whatsapp-message-sender.service"

@Module({
  imports: [MinioModule, ConfigModule],
  providers: [
    WhatsappConnectService,
    WhatsappMessageReceiverService,
    WhatsappMessageSenderService,
  ],
  exports: [WhatsappConnectService],
})
export class WhatsappAdapterModule {}
