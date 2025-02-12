export interface AppConfig {
  env: string
  port: number
  storage: StorageConfig
  rabbitmq: RabbitmqConfig
}

export interface StorageConfig {
  host: string
  port: number
  useSSL: boolean
  accessKey: string
  secretKey: string
  bucketName: string
  uri: string
}

export interface RabbitmqConfig {
  host: string
  port: number
  user: string
  password: string
  uri: string
  whatsappSendMessageQueue: string
  whatsappReceivedMessageQueue: string
}
