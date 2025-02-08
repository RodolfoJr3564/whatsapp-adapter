import { Module } from "@nestjs/common"
import configurations from "config/configurations"
import { ConfigModule } from "@nestjs/config"
import { WhatsappAdapterModule } from "whatsapp-adapter/whatsapp-adapter.module"
import { MinioModule } from "object-storage/minio.module"
import { DatabaseModule } from "database.module"
import { MessageHandlerModule } from './message-handler/message-handler.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configurations],
    }),
    WhatsappAdapterModule,
    MinioModule,
    DatabaseModule,
    MessageHandlerModule,
  ],
})
export class AppModule {}
