import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SessionService } from '../../services/session.service';

@Component({
  selector: 'app-poker-lobby',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-[#0F172A] to-[#1E293B] flex flex-col items-center justify-center px-4">
      <a routerLink="/" class="absolute top-6 left-6 text-xl font-bold text-white/80 hover:text-white transition">
        FocusScrum
      </a>
      <div class="w-full max-w-md">
        <h1 class="text-4xl font-bold text-white text-center mb-2">Planning Poker</h1>
        <p class="text-slate-400 text-center mb-10">Crie uma sessão de estimativa para seu time</p>
        <form (submit)="handleCreate($event)" class="space-y-4">
          <input [(ngModel)]="name" name="name" autofocus
                 placeholder="Nome da sessão..."
                 class="w-full rounded-2xl bg-white/10 border border-white/10 px-5 py-4 text-white text-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition placeholder:text-slate-500" />
          <button type="submit" [disabled]="loading || !name.trim()"
                  class="w-full rounded-2xl bg-blue-600 py-4 text-lg font-semibold text-white shadow-lg shadow-blue-600/30 transition-all hover:bg-blue-500 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed">
            {{ loading ? 'Criando...' : 'Criar Sala' }}
          </button>
        </form>
      </div>
    </div>
  `,
})
export class PokerLobbyComponent {
  name = '';
  loading = false;

  constructor(private router: Router, private session: SessionService) {}

  async handleCreate(e: Event) {
    e.preventDefault();
    const sid = this.session.currentSessionId;
    if (!this.name.trim() || !sid) return;
    this.loading = true;
    const res = await fetch('/api/poker/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: this.name.trim(), sessionId: sid }),
    });
    if (res.ok) {
      const { roomId } = await res.json();
      this.router.navigate(['/poker', roomId]);
    }
    this.loading = false;
  }
}
