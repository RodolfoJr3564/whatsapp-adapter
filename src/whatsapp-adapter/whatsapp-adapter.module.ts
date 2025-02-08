import { Module } from "@nestjs/common"
import { WhatsappConnectService } from "./whatsapp-connection.service"
import { MongooseModule } from "@nestjs/mongoose"
import { Message, MessageSchema } from "./entities/message.schema"
import { Contact, ContactSchema } from "./entities/contact.schema"
import { MinioModule } from "object-storage/minio.module"
import { ConfigModule } from "@nestjs/config"

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
      { name: Contact.name, schema: ContactSchema },
    ]),
    MinioModule,
    ConfigModule,
  ],
  providers: [WhatsappConnectService],
  exports: [WhatsappConnectService],
})
export class WhatsappAdapterModule {}
