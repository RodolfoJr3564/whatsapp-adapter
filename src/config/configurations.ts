import { AppConfig } from "./configurations.interface"

export default () =>
  ({
    env: process.env.NODE_ENV!,
    port: parseInt(process.env.APP_PORT!),

    storage: {
      host: process.env.MINIO_HOST!,
      port: parseInt(process.env.MINIO_PORT!, 10),
      useSSL: process.env.MINIO_SECURE_MODE === "true",
      accessKey: process.env.MINIO_ROOT_USER!,
      secretKey: process.env.MINIO_ROOT_PASSWORD!,
      bucketName: process.env.MINIO_BUCKET_NAME!,

      get uri() {
        return `http${this.useSSL ? "s" : ""}://${this.host}:${this.port}`
      },
    },

    rabbitmq: {
      host: process.env.RABBITMQ_HOST!,
      port: parseInt(process.env.RABBITMQ_PORT!, 10),
      user: process.env.RABBITMQ_USER!,
      password: process.env.RABBITMQ_PASSWORD!,
      whatsappSendMessageQueue: process.env.WHATSAPP_ADAPTER_SEND_MESSAGE_QUEUE,
      whatsappReceivedMessageQueue:
        process.env.WHATSAPP_ADAPTER_RECEIVED_MESSAGE_QUEUE,

      get uri() {
        return `amqp://${this.user}:${this.password}@${this.host}:${this.port}`
      },
    },
  }) as AppConfig
