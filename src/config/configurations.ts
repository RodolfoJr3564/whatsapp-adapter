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
  }) as AppConfig
