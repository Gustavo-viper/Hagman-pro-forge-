import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Sse, type MessageEvent } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Observable } from 'rxjs';
import {
  createEventSchema,
  eventMessageSchema,
  updateEventSchema,
  type CreateEventInput,
  type EventMessageInput,
  type UpdateEventInput,
} from '@fandom/schemas';
import type { AdminEvent, EventMessage, EventRoom } from '@fandom/types';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser, Roles } from '../common/decorators.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { EventRoomService, roomChannel } from './event-room.service.js';

@Controller({ version: '1' })
export class EventRoomController {
  constructor(
    private readonly rooms: EventRoomService,
    private readonly realtime: RealtimeService,
  ) {}

  @Get('events/:id/room')
  room(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<EventRoom> {
    return this.rooms.room(user, id);
  }

  /**
   * Server-Sent Events stream for the room (chat messages, removals, scoreboard changes).
   * Authenticated with the Authorization header (the web client reads it with fetch).
   */
  @Sse('events/:id/room/stream')
  async stream(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<Observable<MessageEvent>> {
    await this.rooms.assertStream(user, id);
    return new Observable<MessageEvent>((subscriber) => {
      const off = this.realtime.subscribe(roomChannel(id), (payload) => subscriber.next({ data: payload as object }));
      // Heartbeat keeps proxies (Railway) from closing an idle connection.
      const ping = setInterval(() => subscriber.next({ data: { type: 'ping' } }), 20_000);
      subscriber.next({ data: { type: 'ready' } });
      return () => {
        off();
        clearInterval(ping);
      };
    });
  }

  @Throttle({ default: { limit: () => Number(process.env.FORUM_RATE_LIMIT_MAX ?? 30), ttl: 60_000 } })
  @Post('events/:id/room/messages')
  post(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(eventMessageSchema)) body: EventMessageInput): Promise<EventMessage> {
    return this.rooms.post(user, id, body.body);
  }

  @Delete('events/:id/room/messages/:messageId')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Param('messageId', ParseIntPipe) messageId: number): Promise<void> {
    await this.rooms.removeMessage(user, id, messageId);
  }

  // ---------------------------------------------------------------- admin

  @Roles('admin', 'editor', 'support')
  @Get('admin/events')
  async adminList(): Promise<{ items: AdminEvent[] }> {
    return { items: await this.rooms.adminList() };
  }

  @Roles('admin', 'editor')
  @Post('admin/events')
  create(@CurrentUser() user: AuthenticatedUser, @Body(new ZodPipe(createEventSchema)) body: CreateEventInput): Promise<AdminEvent> {
    return this.rooms.create(user, body);
  }

  @Roles('admin', 'editor')
  @Patch('admin/events/:id')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(updateEventSchema)) body: UpdateEventInput): Promise<AdminEvent> {
    return this.rooms.update(user, id, body);
  }

  @Roles('admin', 'editor')
  @Post('admin/events/:id/cancel')
  @HttpCode(200)
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<AdminEvent> {
    return this.rooms.cancel(user, id);
  }
}
