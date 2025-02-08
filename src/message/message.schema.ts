import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { HydratedDocument, Types } from "mongoose"
import { MessageTypeEnum } from "whatsapp-adapter/message-type.enum"
import { WAMessage } from "@whiskeysockets/baileys"
import { BaseSchema } from "common/base.schema"
import { Contact } from "contact/contact.schema"

export type MessageDocument = HydratedDocument<Message>

@Schema({ timestamps: true })
export class Message extends BaseSchema {
  @Prop({ type: Types.ObjectId, ref: "Contact", required: true })
  contact: Contact

  @Prop({ type: Date, required: true })
  timestamp: Date

  @Prop({ type: String, enum: MessageTypeEnum, required: true })
  type: MessageTypeEnum

  @Prop({ type: String })
  content: string

  @Prop({ type: String })
  location?: string

  @Prop({ type: Object })
  target: WAMessage
}

export const MessageSchema = SchemaFactory.createForClass(Message)
