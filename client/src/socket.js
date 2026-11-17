import { io } from 'socket.io-client';

export const socket = io();

export function getPlayerId() {
  let id = localStorage.getItem('playerId');
  if (!id) {
    id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('playerId', id);
  }
  return id;
}

export const request = (event, payload) =>
  new Promise((resolve) => socket.emit(event, payload, resolve));
