import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"
import { ConfigModule, ConfigService } from "@nestjs/config"
import { AppConfig } from "config/configurations.interface"

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const databaseConfig =
          configService.get<AppConfig["database"]>("database")

        if (!databaseConfig) throw new Error("ChatbotDatabase config not found")

        return {
          uri: databaseConfig.uri,
          dbName: databaseConfig.name,
        }
      },
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
