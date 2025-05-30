import { NestFactory } from "@nestjs/core"
import { AppModule } from "./app.module"
import { Logger } from "@nestjs/common"
import configurations from "config/configurations"
import { MicroserviceOptions, Transport } from "@nestjs/microservices"
;(async () => {
  const logger = new Logger("Bootstrap")
  logger.log("Iniciando aplicação NestJS...")
  const config = configurations()

  const app = await NestFactory.create(AppModule, {
    logger:
      config.env === "production"
        ? ["error", "warn", "log"]
        : ["error", "warn", "log", "debug", "verbose"],
  })

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [config.rabbitmq.uri],
      queue: config.rabbitmq.whatsappSendMessageQueue,
      queueOptions: {
        durable: false,
      },
      prefetchCount: 1,
      noAck: false,
    },
  })

  await app.startAllMicroservices()

  await app.listen(config.port, () => {
    logger.log(`Application is running in ${process.env.NODE_ENV}`)
    app.getUrl().then(url => {
      logger.log(`Host: ${url}`)
    })
  })
  logger.log("Aplicação NestJS está rodando na porta 3000.")
})()
