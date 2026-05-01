import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/landing/landing.component').then(m => m.LandingComponent) },
  { path: 'retro', loadComponent: () => import('./pages/my-boards/my-boards.component').then(m => m.MyBoardsComponent) },
  { path: 'retro/:inviteCode', loadComponent: () => import('./pages/retro-board/retro-board.component').then(m => m.RetroBoardComponent) },
  { path: 'poker', loadComponent: () => import('./pages/poker-lobby/poker-lobby.component').then(m => m.PokerLobbyComponent) },
  { path: 'poker/:roomId', loadComponent: () => import('./pages/poker-room/poker-room.component').then(m => m.PokerRoomComponent) },
];
