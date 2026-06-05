import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../services/theme.service';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      (click)="theme.toggle()"
      [title]="theme.isDark ? 'Mudar para modo claro' : 'Mudar para modo escuro'"
      class="rounded-xl border border-slate-300 dark:border-slate-700 w-9 h-9 flex items-center justify-center text-base text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
      {{ theme.isDark ? '☀️' : '🌙' }}
    </button>
  `,
})
export class ThemeToggleComponent {
  constructor(public theme: ThemeService) {}
}
