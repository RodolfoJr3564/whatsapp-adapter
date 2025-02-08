export interface AppConfig {
  env: string
  port: number
  database: databaseConfig
  storage: StorageConfig
}

export interface databaseConfig {
  host: string
  port: number
  username: string
  password: string
  name: string
  uri: string
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
