import { Module, Global } from "@nestjs/common"
import { ConfigModule, ConfigService } from "@nestjs/config"
import { ClientsModule, Transport } from "@nestjs/microservices"
import { RabbitmqConfig } from "config/configurations.interface"

@Global()
@Module({
  imports: [
    ConfigModule,
    ClientsModule.registerAsync([
      {
        name: "DISPATCH_RECEIVED_MESSAGE_CLIENT",
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => {
          const rabbitConfig = configService.get<RabbitmqConfig>("rabbitmq")
          if (!rabbitConfig) {
            throw new Error("RabbitMQ configuration not found")
          }
          return {
            transport: Transport.RMQ,
            options: {
              urls: [rabbitConfig.uri],
              queue: rabbitConfig.whatsappReceivedMessageQueue,
              queueOptions: { durable: false },
              prefetchCount: 1,
            },
          }
        },
        inject: [ConfigService],
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class RabbitmqModule {}
