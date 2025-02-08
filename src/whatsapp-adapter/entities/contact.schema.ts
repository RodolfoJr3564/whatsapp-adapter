import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { HydratedDocument } from "mongoose"
import { BaseSchema } from "../../common/base.schema"

export type ContactDocument = HydratedDocument<Contact>

@Schema({ timestamps: true })
export class Contact extends BaseSchema {
  @Prop({ type: String, required: true })
  whatsappContactName: string

  @Prop({ type: String, required: true })
  whatsappContactId: string

  @Prop({ type: String, required: true })
  number: string

  @Prop({ type: Boolean })
  isGroup: boolean

  @Prop({ type: Boolean, default: false })
  fromMe: boolean
}

export const ContactSchema = SchemaFactory.createForClass(Contact)
