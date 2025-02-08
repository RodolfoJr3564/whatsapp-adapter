import { NestFactory } from "@nestjs/core"
import { AppModule } from "./app.module"
import { Logger } from "@nestjs/common"
import configurations from "config/configurations"
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

  await app.listen(config.port, () => {
    logger.log(`Application is running in ${process.env.NODE_ENV}`)
    app.getUrl().then(url => {
      logger.log(`Host: ${url}`)
    })
  })
  logger.log("Aplicação NestJS está rodando na porta 3000.")
})()
