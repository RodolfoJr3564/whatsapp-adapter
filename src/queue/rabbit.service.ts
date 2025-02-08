import { Injectable } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from "@nestjs/microservices"
import { Observable } from "rxjs"
import { RabbitmqConfig } from "config/configurations.interface"

@Injectable()
export class RabbitmqService {
  private client: ClientProxy

  constructor(private readonly configService: ConfigService) {
    const rabbitmqConfig = this.configService.get<RabbitmqConfig>(
      "rabbitmq",
    ) as RabbitmqConfig

    this.client = ClientProxyFactory.create({
      transport: Transport.RMQ,
      options: {
        urls: [rabbitmqConfig.uri],
        queue: rabbitmqConfig.queue,
        queueOptions: {
          durable: false,
        },
      },
    })
  }

  public send<T = any, R = any>(pattern: string, data: T): Observable<R> {
    return this.client.send<R, T>(pattern, data)
  }

  public emit<T = any>(pattern: string, data: T): Observable<void> {
    return this.client.emit(pattern, data)
  }
}
