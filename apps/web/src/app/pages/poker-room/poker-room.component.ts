import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Socket } from 'socket.io-client';
import { SocketService } from '../../services/socket.service';
import { SessionService } from '../../services/session.service';
import { FIBONACCI_SCALE, type PokerRoom, type PokerParticipant, type PokerValue } from '@focusscrum/shared';

@Component({
  selector: 'app-poker-room',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <!-- Join screen -->
    @if (!joined) {
      <div class="min-h-screen bg-gradient-to-br from-[#0F172A] to-[#1E293B] flex items-center justify-center px-4">
        <div class="w-full max-w-sm">
          @if (error) {
            <div class="text-center">
              <p class="text-red-400 text-lg mb-4">{{ error }}</p>
              <a routerLink="/poker" class="text-blue-400 hover:text-blue-300">Voltar</a>
            </div>
          } @else {
            <form (submit)="handleJoin($event)" class="space-y-4">
              <h2 class="text-2xl font-bold text-white text-center mb-6">Entrar na Sala</h2>
              <input [(ngModel)]="displayName" name="displayName" autofocus
                     placeholder="Seu nome..."
                     class="w-full rounded-2xl bg-white/10 border border-white/10 px-5 py-4 text-white text-lg outline-none focus:ring-2 focus:ring-blue-500 transition placeholder:text-slate-500" />
              <button type="submit" [disabled]="!displayName.trim()"
                      class="w-full rounded-2xl bg-blue-600 py-4 text-lg font-semibold text-white shadow-lg shadow-blue-600/30 transition-all hover:bg-blue-500 disabled:opacity-50">
                Entrar
              </button>
            </form>
          }
        </div>
      </div>
    }

    <!-- Room -->
    @if (joined && room) {
      <div class="min-h-screen bg-gradient-to-br from-[#0F172A] to-[#1E293B] flex flex-col">
        <!-- Header -->
        <header class="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div class="flex items-center gap-4">
            <a routerLink="/" class="text-lg font-bold text-white/80 hover:text-white transition">FocusScrum</a>
            <span class="text-white/20">|</span>
            <h1 class="font-semibold text-white">{{ room.name }}</h1>
            @if (room.roundNumber > 0) {
              <span class="text-sm text-slate-400 bg-white/5 rounded-full px-3 py-1">Rodada {{ room.roundNumber }}</span>
            }
          </div>
          <div class="flex items-center gap-3">
            <button (click)="handleCopyLink()"
                    class="rounded-xl border border-white/20 px-4 py-2 text-sm text-white/70 hover:bg-white/10 transition">
              Copiar link
            </button>
            @if (isOwner) {
              @if (room.status !== 'voting') {
                <button (click)="handleStartRound()"
                        class="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition">
                  {{ room.roundNumber === 0 ? 'Iniciar Rodada' : 'Nova Rodada' }}
                </button>
              } @else {
                <button (click)="handleEndRound()"
                        class="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 transition">
                  Revelar Votos
                </button>
              }
            }
          </div>
        </header>

        <!-- Main -->
        <main class="flex-1 flex flex-col items-center justify-center gap-12 px-6 py-8">
          <!-- Participants -->
          <div class="flex flex-wrap justify-center gap-6 max-w-4xl">
            @for (p of room.participants; track p.sessionId) {
              <div class="flex flex-col items-center gap-2">
                <div class="w-16 h-24 rounded-2xl flex items-center justify-center text-xl font-bold transition-all duration-500"
                     [class]="getCardClass(p)">
                  {{ getCardDisplay(p) }}
                </div>
                <span class="text-sm max-w-[80px] truncate"
                      [class]="p.sessionId === sessionId ? 'text-blue-400 font-semibold' : 'text-slate-400'">
                  {{ p.displayName }}
                </span>
              </div>
            }
          </div>

          <!-- Stats -->
          @if (room.status === 'revealed' && numericVotes.length > 0) {
            <div class="flex gap-8 text-center">
              <div>
                <div class="text-3xl font-bold text-white">{{ avg.toFixed(1) }}</div>
                <div class="text-xs text-slate-400 mt-1">Média</div>
              </div>
              <div>
                <div class="text-3xl font-bold text-white">{{ min }}</div>
                <div class="text-xs text-slate-400 mt-1">Menor</div>
              </div>
              <div>
                <div class="text-3xl font-bold text-white">{{ max }}</div>
                <div class="text-xs text-slate-400 mt-1">Maior</div>
              </div>
            </div>
          }

          <!-- Voting cards -->
          @if (room.status === 'voting' && !isOwner) {
            <div class="flex flex-wrap justify-center gap-3 max-w-3xl">
              @for (value of fibScale; track value) {
                <button (click)="handleVote(value)"
                        class="w-16 h-24 rounded-2xl text-xl font-bold transition-all duration-200"
                        [class]="selectedVote === value
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/40 -translate-y-2 ring-2 ring-blue-400'
                          : 'bg-[#1E3A5F] text-white/80 hover:bg-[#2563EB] hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-500/20'">
                  {{ value }}
                </button>
              }
            </div>
          }

          <!-- Waiting -->
          @if (room.status === 'waiting') {
            <p class="text-slate-500 text-lg">
              {{ isOwner ? 'Clique "Iniciar Rodada" quando todos estiverem prontos' : 'Aguardando o facilitador iniciar a rodada...' }}
            </p>
          }
        </main>
      </div>
    }
  `,
})
export class PokerRoomComponent implements OnInit, OnDestroy {
  socket: Socket | null = null;
  room: PokerRoom | null = null;
  joined = false;
  displayName = '';
  selectedVote: PokerValue | null = null;
  error: string | null = null;
  sessionId: string | null = null;
  fibScale = FIBONACCI_SCALE;

  get isOwner(): boolean {
    return this.room?.ownerId === this.sessionId;
  }

  get numericVotes(): number[] {
    if (this.room?.status !== 'revealed') return [];
    return this.room.participants
      .filter(p => typeof p.vote === 'number')
      .map(p => p.vote as number);
  }

  get avg(): number {
    const v = this.numericVotes;
    return v.length > 0 ? v.reduce((a, b) => a + b, 0) / v.length : 0;
  }

  get min(): number { return Math.min(...this.numericVotes); }
  get max(): number { return Math.max(...this.numericVotes); }

  constructor(
    private route: ActivatedRoute,
    private socketService: SocketService,
    private session: SessionService,
  ) {}

  ngOnInit() {
    const roomId = this.route.snapshot.paramMap.get('roomId');
    if (!roomId) return;

    this.session.whenReady().then(sid => {
      this.sessionId = sid;
      this.socket = this.socketService.createPokerSocket(roomId);
      this.setupSocketEvents();
    });
  }

  private setupSocketEvents() {
    if (!this.socket) return;
    const s = this.socket;

    s.on('poker:state', (state: PokerRoom) => {
      this.room = state;
      this.joined = true;
    });

    s.on('poker:participant_joined', (p: { sessionId: string; displayName: string }) => {
      if (!this.room) return;
      if (this.room.participants.some(x => x.sessionId === p.sessionId)) return;
      this.room = { ...this.room, participants: [...this.room.participants, { ...p, hasVoted: false }] };
    });

    s.on('poker:participant_left', (p: { sessionId: string }) => {
      if (!this.room) return;
      this.room = { ...this.room, participants: this.room.participants.filter(x => x.sessionId !== p.sessionId) };
    });

    s.on('poker:vote_cast', ({ sessionId }: { sessionId: string }) => {
      if (!this.room) return;
      this.room = {
        ...this.room,
        participants: this.room.participants.map(p => p.sessionId === sessionId ? { ...p, hasVoted: true } : p),
      };
    });

    s.on('poker:round_started', ({ roundNumber }: { roundNumber: number }) => {
      this.selectedVote = null;
      if (!this.room) return;
      this.room = {
        ...this.room,
        status: 'voting',
        roundNumber,
        participants: this.room.participants.map(p => ({ ...p, hasVoted: false, vote: undefined })),
      };
    });

    s.on('poker:round_ended', ({ votes }: { votes: Array<{ sessionId: string; displayName: string; value: PokerValue }> }) => {
      if (!this.room) return;
      this.room = {
        ...this.room,
        status: 'revealed',
        participants: this.room.participants.map(p => {
          const v = votes.find(x => x.sessionId === p.sessionId);
          return { ...p, hasVoted: !!v, vote: v?.value };
        }),
      };
    });

    s.on('error', (e: { message: string }) => this.error = e.message);
  }

  ngOnDestroy() {
    this.socket?.disconnect();
  }

  handleJoin(e: Event) {
    e.preventDefault();
    if (!this.displayName.trim() || !this.socket || !this.sessionId) return;
    this.socket.emit('poker:join', { displayName: this.displayName.trim(), sessionId: this.sessionId });
  }

  handleVote(value: PokerValue) {
    if (!this.socket || this.room?.status !== 'voting') return;
    this.selectedVote = value;
    this.socket.emit('poker:vote', { value });
  }

  handleStartRound() { this.socket?.emit('poker:start_round'); }
  handleEndRound() { this.socket?.emit('poker:end_round'); }

  handleCopyLink() {
    navigator.clipboard.writeText(window.location.href);
  }

  getCardClass(p: PokerParticipant): string {
    const showVote = this.room?.status === 'revealed' && p.vote !== undefined;
    if (showVote) return 'bg-blue-600 text-white shadow-lg shadow-blue-600/30';
    if (p.hasVoted) return 'bg-emerald-600/80 text-white shadow-md';
    return 'bg-white/5 border border-white/10 text-white/30';
  }

  getCardDisplay(p: PokerParticipant): string {
    const showVote = this.room?.status === 'revealed' && p.vote !== undefined;
    if (showVote) return String(p.vote);
    if (p.hasVoted) return '✓';
    return '?';
  }
}
