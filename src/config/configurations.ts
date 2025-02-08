import { AppConfig } from "./configurations.interface"

export default () =>
  ({
    env: process.env.NODE_ENV!,
    port: parseInt(process.env.APP_PORT!),

    database: {
      host: process.env.MONGO_HOST!,
      port: parseInt(process.env.MONGO_PORT!, 10),
      username: process.env.MONGO_INITDB_ROOT_USERNAME!,
      password: process.env.MONGO_INITDB_ROOT_PASSWORD!,
      name: process.env.MONGO_INITDB_DATABASE!,

      get uri() {
        return `mongodb://${this.username}:${this.password}@${this.host}:${this.port}`
      },
    },

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
