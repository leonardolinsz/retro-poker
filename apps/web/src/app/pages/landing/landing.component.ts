import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 px-4">
      <div class="text-center max-w-2xl">
        <h1 class="text-6xl font-bold tracking-tight mb-4 bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
          FocusScrum
        </h1>
        <p class="text-xl text-slate-500 dark:text-slate-400 mb-12">
          Retrospectivas e Planning Poker colaborativos em tempo real. Sem cadastro, sem fricção.
        </p>
        <div class="flex flex-col sm:flex-row gap-4 justify-center">
          <a routerLink="/retro"
             class="group relative inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-600/30 hover:-translate-y-0.5">
            Retrospectiva
          </a>
          <a routerLink="/poker"
             class="group relative inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-800 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-slate-800/25 transition-all hover:bg-slate-700 hover:shadow-xl hover:shadow-slate-800/30 hover:-translate-y-0.5 dark:bg-slate-700 dark:hover:bg-slate-600">
            Planning Poker
          </a>
        </div>
      </div>
      <footer class="absolute bottom-8 text-sm text-slate-400">
        Colaboração em tempo real — zero cadastro
      </footer>
    </div>
  `,
})
export class LandingComponent {}
