import { Injectable, Logger } from "@nestjs/common"
import { Client } from "minio"
import { ConfigService } from "@nestjs/config"
import { AppConfig } from "config/configurations.interface"
import { mkdirSync, createWriteStream } from "fs"
import * as path from "path"

@Injectable()
export class MinioService {
  private readonly logger = new Logger(MinioService.name)
  private minioClient: Client

  constructor(private readonly configService: ConfigService) {
    const minioConfig = this.configService.get<AppConfig["storage"]>("storage")
    if (!minioConfig) {
      throw new Error("Configuração de storage não encontrada.")
    }
    this.minioClient = new Client({
      endPoint: minioConfig.host,
      port: minioConfig.port,
      useSSL: minioConfig.useSSL,
      accessKey: minioConfig.accessKey,
      secretKey: minioConfig.secretKey,
    })
  }

  private async initializeBucket(bucketName: string) {
    try {
      const exists = await this.minioClient.bucketExists(bucketName)
      if (!exists) {
        await this.minioClient.makeBucket(bucketName)
        this.logger.log(`Bucket "${bucketName}" criado com sucesso.`)
      } else {
        this.logger.log(`Bucket "${bucketName}" já existe.`)
      }
    } catch (error) {
      this.logger.error("Erro ao inicializar o bucket MinIO:", error)
    }
  }

  async uploadFile(
    objectName: string,
    buffer: Buffer,
    mimeType: string,
    bucketName: string,
  ): Promise<string> {
    const metaData = {
      "Content-Type": mimeType,
    }

    await this.initializeBucket(bucketName)

    try {
      await this.minioClient.putObject(
        bucketName,
        objectName,
        buffer,
        buffer.length,
        metaData,
      )

      this.logger.log(
        `Arquivo "${objectName}" enviado com sucesso para o MinIO.`,
      )
      return objectName
    } catch (error) {
      this.logger.error("Erro ao enviar arquivo para o MinIO:", error)
      throw error
    }
  }

  async downloadFile(
    bucketName: string,
    objectName: string,
    localPath: string,
  ): Promise<string> {
    try {
      mkdirSync(path.dirname(localPath), { recursive: true })

      const stream = await this.minioClient.getObject(bucketName, objectName)

      const writeStream = createWriteStream(localPath)

      await new Promise<void>((resolve, reject) => {
        stream.pipe(writeStream).on("finish", resolve).on("error", reject)
      })

      console.log(
        `Arquivo "${objectName}" baixado com sucesso em: ${localPath}.`,
      )

      return localPath
    } catch (error) {
      console.error("Erro ao baixar arquivo do MinIO:", error)
      throw error
    }
  }
}
