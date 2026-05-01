import { Injectable } from '@angular/core';
import { BehaviorSubject, filter, firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private sessionId$ = new BehaviorSubject<string | null>(null);
  private loading$ = new BehaviorSubject<boolean>(true);

  readonly sessionId = this.sessionId$.asObservable();
  readonly loading = this.loading$.asObservable();

  get currentSessionId(): string | null {
    return this.sessionId$.value;
  }

  constructor() {
    this.init();
  }

  async whenReady(): Promise<string | null> {
    await firstValueFrom(this.loading$.pipe(filter(l => !l)));
    return this.sessionId$.value;
  }

  private async init() {
    try {
      const res = await fetch('/api/me', { credentials: 'include' });
      const data = await res.json();
      this.sessionId$.next(data.sessionId);
    } catch {
      // no session yet
    } finally {
      this.loading$.next(false);
    }
  }
}
