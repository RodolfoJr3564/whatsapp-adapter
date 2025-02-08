export interface AppConfig {
  env: string
  port: number
  storage: StorageConfig
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
