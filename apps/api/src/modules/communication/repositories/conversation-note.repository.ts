import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { ConversationNote, ConversationNoteDocument } from "../schemas/conversation-note.schema.js";

export interface CreateConversationNoteInput {
  workspaceId: string;
  conversationId: string;
  authorUserId: string;
  text: string;
}

@Injectable()
export class ConversationNoteRepository {
  constructor(
    @InjectModel(ConversationNote.name)
    private readonly noteModel: Model<ConversationNoteDocument>,
  ) {}

  async create(input: CreateConversationNoteInput): Promise<ConversationNoteDocument> {
    return this.noteModel.create(input);
  }

  async findByConversation(
    workspaceId: string,
    conversationId: string,
  ): Promise<ConversationNoteDocument[]> {
    return this.noteModel.find({ workspaceId, conversationId }).sort({ createdAt: -1 }).exec();
  }
}
