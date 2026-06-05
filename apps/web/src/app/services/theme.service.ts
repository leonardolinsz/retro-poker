import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

const STORAGE_KEY = 'focusscrum-dark-mode';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private dark$ = new BehaviorSubject<boolean>(true);

  get isDark(): boolean {
    return this.dark$.value;
  }

  constructor() {
    const saved = localStorage.getItem(STORAGE_KEY);
    // default = dark
    const isDark = saved === null ? true : saved === 'true';
    this.apply(isDark);
  }

  toggle() {
    this.apply(!this.dark$.value);
  }

  private apply(isDark: boolean) {
    this.dark$.next(isDark);
    localStorage.setItem(STORAGE_KEY, String(isDark));
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
}
