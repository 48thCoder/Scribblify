export const AVATARS = [
  { id: 0, emoji: '😀', label: 'Happy' },
  { id: 1, emoji: '😎', label: 'Cool' },
  { id: 2, emoji: '🤓', label: 'Nerdy' },
  { id: 3, emoji: '🥳', label: 'Party' },
  { id: 4, emoji: '🤠', label: 'Cowboy' },
  { id: 5, emoji: '🐱', label: 'Cat' },
  { id: 6, emoji: '🐶', label: 'Dog' },
  { id: 7, emoji: '🦊', label: 'Fox' },
  { id: 8, emoji: '🐼', label: 'Panda' },
  { id: 9, emoji: '🐸', label: 'Frog' },
  { id: 10, emoji: '🐵', label: 'Monkey' },
  { id: 11, emoji: '🦄', label: 'Unicorn' },
];

export function getAvatar(index) {
  const i = Math.max(0, Math.min(AVATARS.length - 1, Number(index) || 0));
  return AVATARS[i];
}
