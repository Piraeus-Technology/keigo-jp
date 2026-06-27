export type PracticeSettingsParams = { mode: 'quiz' | 'flashcards' };

export type SearchStackParamList = {
  SearchHome: undefined;
  Detail: { key: string; type: 'verb' | 'expression' };
};

export type QuizStackParamList = {
  QuizMain: undefined;
  PracticeSettings: PracticeSettingsParams;
};

export type FlashcardStackParamList = {
  FlashcardMain: undefined;
  PracticeSettings: PracticeSettingsParams;
};

export type GuideStackParamList = {
  GuideMain: undefined;
};

export type MoreStackParamList = {
  MoreMain: undefined;
  Stats: undefined;
  FlashcardStats: undefined;
};
