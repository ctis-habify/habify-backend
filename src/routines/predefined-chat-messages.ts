export type PredefinedMessageCategory = 'motivation' | 'checkin' | 'support' | 'spicy' | 'funny';

export type PredefinedChatMessageItem = {
  text: string;
  category: PredefinedMessageCategory;
  color: string;
  order: number;
};

export const PREDEFINED_CHAT_MESSAGES_CATEGORIZED: PredefinedChatMessageItem[] = [
  { text: 'Let’s do our best today!', category: 'motivation', color: '#22c55e', order: 1 },
  { text: 'Great job, everyone!', category: 'motivation', color: '#22c55e', order: 2 },
  { text: 'Let’s keep our streak going!', category: 'motivation', color: '#22c55e', order: 3 },
  { text: 'Congratulations on your progress!', category: 'motivation', color: '#22c55e', order: 4 },
  { text: 'Let’s motivate each other!', category: 'motivation', color: '#22c55e', order: 5 },

  { text: 'I completed my routine!', category: 'checkin', color: '#3b82f6', order: 6 },
  { text: 'Don’t forget to check in!', category: 'checkin', color: '#3b82f6', order: 7 },
  { text: 'I might be late today.', category: 'checkin', color: '#3b82f6', order: 8 },

  {
    text: 'Can someone help me with this routine?',
    category: 'support',
    color: '#f59e0b',
    order: 9,
  },
  { text: 'I need some encouragement!', category: 'support', color: '#f59e0b', order: 10 },

  { text: 'Still zero. Wow.', category: 'spicy', color: '#ef4444', order: 11 },
  { text: 'Excuses again?', category: 'spicy', color: '#ef4444', order: 12 },
  { text: 'Try showing up first.', category: 'spicy', color: '#ef4444', order: 13 },
  { text: 'Team carrying hard.', category: 'spicy', color: '#ef4444', order: 14 },
  { text: 'Alarm won again?', category: 'spicy', color: '#ef4444', order: 15 },

  { text: 'Oops, my bed won the battle today! 🛏️', category: 'funny', color: '#e879f9', order: 16 },
  {
    text: 'Routine? I thought you said “ruin” my plans!',
    category: 'funny',
    color: '#e879f9',
    order: 17,
  },
  { text: 'I’m on a break... a very long one.', category: 'funny', color: '#e879f9', order: 18 },
  {
    text: 'Does thinking about routines count as doing them?',
    category: 'funny',
    color: '#e879f9',
    order: 19,
  },
  { text: 'I’ll start... tomorrow. Probably.', category: 'funny', color: '#e879f9', order: 20 },
  {
    text: 'My coffee needs more coffee before I start.',
    category: 'funny',
    color: '#e879f9',
    order: 21,
  },
  { text: 'I almost did it. Almost.', category: 'funny', color: '#e879f9', order: 22 },
  { text: 'I’m just here for the chat.', category: 'funny', color: '#e879f9', order: 23 },
  {
    text: 'If procrastination was a routine, I’d ace it!',
    category: 'funny',
    color: '#e879f9',
    order: 24,
  },
  { text: 'I’m supporting you... from my couch!', category: 'funny', color: '#e879f9', order: 25 },
];

export const PREDEFINED_CHAT_MESSAGES = PREDEFINED_CHAT_MESSAGES_CATEGORIZED.map(
  (item) => item.text,
);
