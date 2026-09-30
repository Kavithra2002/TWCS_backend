import { EventEmitter } from 'events';
import { logger } from '../logger';
import type { DomainEventName, DomainEvents } from './event-types';

type Handler<K extends DomainEventName> = (payload: DomainEvents[K]) => void | Promise<void>;

/** In-process, typed pub/sub used for communication between modules. */
class EventBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(50);
  }

  emit<K extends DomainEventName>(event: K, payload: DomainEvents[K]): void {
    this.emitter.emit(event, payload);
  }

  on<K extends DomainEventName>(event: K, handler: Handler<K>): () => void {
    const wrapped = (payload: DomainEvents[K]) => {
      Promise.resolve(handler(payload)).catch((err) => logger.error({ err, event }, 'Event handler failed'));
    };
    this.emitter.on(event, wrapped);
    return () => this.emitter.off(event, wrapped);
  }
}

export const eventBus = new EventBus();
export * from './event-types';
